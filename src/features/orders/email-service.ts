import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { clients, orderEmailDeliveries, paymentOrders } from "@/db/schema";
import { sendOrderMessage } from "@/features/email/mailer";
import { safeError, AppError } from "@/lib/errors";
import { getEnv } from "@/lib/env";
import { decryptPublicToken } from "./public-token";
import { createOrderPdfBytes } from "./pdf";
import { findOrderPdf } from "./pdf-service";

const emailOrderFields = {
  id: paymentOrders.id,
  number: paymentOrders.number,
  status: paymentOrders.status,
  version: paymentOrders.version,
  publicTokenHash: paymentOrders.publicTokenHash,
  publicTokenCiphertext: paymentOrders.publicTokenCiphertext,
  publicTokenIv: paymentOrders.publicTokenIv,
  publicTokenAuthTag: paymentOrders.publicTokenAuthTag,
  clientEmail: clients.email,
  clientName: clients.legalName,
};

type OrderEmailResult = { publicToken: string; publicLink: string };
type OrderTransaction = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

async function recordDelivery(db: ReturnType<typeof getDb> | OrderTransaction, input: { id: string; orderId: string; userId: string; recipient: string; status: "pending" | "sent" | "failed"; errorCode?: string; safeMessage?: string }): Promise<void> {
  await db.insert(orderEmailDeliveries).values({
    id: input.id,
    paymentOrderId: input.orderId,
    recipient: input.recipient,
    status: input.status,
    errorCode: input.errorCode ?? null,
    safeMessage: input.safeMessage ?? null,
    sentAt: input.status === "sent" ? new Date() : null,
    createdBy: input.userId,
  });
}

export type OrderEmailDependencies = {
  database?: () => ReturnType<typeof getDb>;
  transaction?: <T>(callback: (tx: OrderTransaction) => Promise<T>) => Promise<T>;
  findOrderPdf?: typeof findOrderPdf;
  createOrderPdfBytes?: typeof createOrderPdfBytes;
  sendOrderMessage?: typeof sendOrderMessage;
  decryptPublicToken?: typeof decryptPublicToken;
  appUrl?: () => string;
};

export async function sendOrderEmail(orderId: string, userId: string, dependencies: OrderEmailDependencies = {}, customRecipient?: string): Promise<OrderEmailResult> {
  let recipient = "";
  let orderLoaded = false;
  const deliveryId = randomUUID();
  let deliveryRecorded = false;
  let preparedCommitted = false;
  let smtpAttempted = false;
  const database = dependencies.database ?? getDb;
  const transaction = dependencies.transaction ?? ((callback) => database().transaction(callback));
  const findPdf = dependencies.findOrderPdf ?? findOrderPdf;
  const createPdfBytes = dependencies.createOrderPdfBytes ?? createOrderPdfBytes;
  const sendMessage = dependencies.sendOrderMessage ?? sendOrderMessage;
  const decryptToken = dependencies.decryptPublicToken ?? decryptPublicToken;
  const appUrl = dependencies.appUrl ?? (() => getEnv().APP_URL);

  try {
    const prepared = await transaction(async (tx) => {
      const [order] = await tx.select(emailOrderFields).from(paymentOrders).innerJoin(clients, eq(clients.id, paymentOrders.clientId)).where(eq(paymentOrders.id, orderId)).limit(1).for("update").execute();
      if (!order) throw new AppError("ORDER_NOT_FOUND", "Orden no encontrada.", 404);
      orderLoaded = true;
      recipient = (customRecipient?.trim() || order.clientEmail).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) throw new AppError("ORDER_EMAIL_INVALID", "El correo de destino no es válido.");
      if (order.status !== "issued" && order.status !== "paid" && order.status !== "invoiced") throw new AppError("ORDER_EMAIL_NOT_AVAILABLE", "La orden debe estar emitida antes de enviarla por correo.");
      const [pending] = await tx.select({ id: orderEmailDeliveries.id }).from(orderEmailDeliveries).where(and(eq(orderEmailDeliveries.paymentOrderId, orderId), eq(orderEmailDeliveries.status, "pending"))).limit(1).for("update").execute();
      if (pending) throw new AppError("ORDER_EMAIL_IN_PROGRESS", "Ya existe un envío de correo pendiente para esta orden.", 409);
      if (!order.publicTokenHash || !order.publicTokenCiphertext || !order.publicTokenIv || !order.publicTokenAuthTag) throw new AppError("ORDER_PUBLIC_LINK_UNAVAILABLE", "La orden no tiene un enlace público vigente. Emítela nuevamente antes de enviarla.", 409);
      const token = decryptToken({ ciphertext: order.publicTokenCiphertext, iv: order.publicTokenIv, authTag: order.publicTokenAuthTag });
      const pdfOrder = await findPdf(orderId);
      if (!pdfOrder) throw new AppError("ORDER_PDF_NOT_FOUND", "No pudimos preparar el PDF de la orden.");
      const pdf = await createPdfBytes(pdfOrder);
      const claim = await tx.update(paymentOrders).set({ version: order.version + 1, updatedAt: new Date() }).where(and(eq(paymentOrders.id, orderId), eq(paymentOrders.version, order.version), eq(paymentOrders.publicTokenHash, order.publicTokenHash))).execute();
      if (Number(claim[0]?.affectedRows ?? 0) !== 1) throw new AppError("ORDER_VERSION_CONFLICT", "La orden cambió antes de preparar el correo. El enlace anterior sigue vigente.", 409);
       await recordDelivery(tx, { id: deliveryId, orderId, userId, recipient, status: "pending" });
       deliveryRecorded = true;
      return { token, pdf, number: order.number, name: order.clientName, publicTokenHash: order.publicTokenHash, version: order.version + 1 };
    });
    preparedCommitted = true;

    return await transaction(async (tx) => {
      const [current] = await tx.select({ version: paymentOrders.version, publicTokenHash: paymentOrders.publicTokenHash }).from(paymentOrders).where(eq(paymentOrders.id, orderId)).limit(1).for("update").execute();
      const [pending] = await tx.select({ id: orderEmailDeliveries.id }).from(orderEmailDeliveries).where(and(eq(orderEmailDeliveries.id, deliveryId!), eq(orderEmailDeliveries.status, "pending"))).limit(1).for("update").execute();
      if (!current || current.version !== prepared.version || current.publicTokenHash !== prepared.publicTokenHash || !pending) throw new AppError("ORDER_VERSION_CONFLICT", "La orden cambió antes de enviar el correo. El enlace anterior sigue vigente.", 409);
      smtpAttempted = true;
      await sendMessage({ to: recipient, name: prepared.name, number: prepared.number, publicUrl: `${appUrl()}/orden/${prepared.token}`, pdf: prepared.pdf });
      const result = await tx.update(orderEmailDeliveries).set({ status: "sent", sentAt: new Date() }).where(and(eq(orderEmailDeliveries.id, deliveryId!), eq(orderEmailDeliveries.status, "pending"))).execute();
      if (Number(result[0]?.affectedRows ?? 0) !== 1) throw new AppError("ORDER_EMAIL_COMMIT_UNCERTAIN", "El envío fue entregado pero no pudimos confirmar su auditoría. No lo reintentes automáticamente.", 503);
      return { publicToken: prepared.token, publicLink: `/orden/${prepared.token}` };
    });
  } catch (error) {
    const safe = safeError(error);
    if (preparedCommitted) {
      await database().update(orderEmailDeliveries).set({ errorCode: safe.code, safeMessage: safe.message, ...(smtpAttempted ? {} : { status: "failed" as const }) }).where(and(eq(orderEmailDeliveries.id, deliveryId), eq(orderEmailDeliveries.status, "pending"))).execute();
    } else if (orderLoaded && !deliveryRecorded) {
      await recordDelivery(database(), { id: deliveryId, orderId, userId, recipient, status: "failed", errorCode: safe.code, safeMessage: safe.message });
    }
    throw error;
  }
}
