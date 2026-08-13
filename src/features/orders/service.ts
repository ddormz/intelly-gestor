import { randomUUID } from "node:crypto";
import { and, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { catalogItems, clients, paymentOrderLines, paymentOrders, payments } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { hashToken, randomToken } from "@/lib/security";
import { assertTransition, calculateOrder } from "./domain";
import { clp } from "@/lib/money";

export async function listOrders() {
  return getDb().select({ id: paymentOrders.id, number: paymentOrders.number, status: paymentOrders.status, total: paymentOrders.total, createdAt: paymentOrders.createdAt, clientName: clients.legalName })
    .from(paymentOrders).innerJoin(clients, eq(clients.id, paymentOrders.clientId)).orderBy(desc(paymentOrders.createdAt)).limit(100);
}

export async function createOrder(input: { clientId: string; catalogItemId: string; quantity: number; userId: string }) {
  const [item] = await getDb().select().from(catalogItems).where(and(eq(catalogItems.id, input.catalogItemId), eq(catalogItems.status, "active"))).limit(1);
  if (!item) throw new AppError("ITEM_NOT_FOUND", "El producto o servicio no está disponible.", 404);
  const calculated = calculateOrder([{ description: item.name, quantity: input.quantity, unitPrice: clp(BigInt(item.unitPrice.split(".")[0])), taxRate: Number(item.taxRate) }]);
  const id = randomUUID();
  const number = `OP-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${id.slice(0, 6).toUpperCase()}`;
  await getDb().transaction(async (tx) => {
    await tx.insert(paymentOrders).values({ id, number, clientId: input.clientId, status: "draft", currency: "CLP", subtotal: String(calculated.subtotal.minor), taxTotal: String(calculated.tax.minor), total: String(calculated.total.minor), createdBy: input.userId, updatedBy: input.userId });
    await tx.insert(paymentOrderLines).values({ id: randomUUID(), paymentOrderId: id, catalogItemId: item.id, code: item.code, description: item.name, quantity: String(input.quantity), unitPrice: item.unitPrice, taxRate: item.taxRate, subtotal: String(calculated.subtotal.minor), taxAmount: String(calculated.tax.minor), total: String(calculated.total.minor) });
  });
  return id;
}

export async function issueOrder(id: string, userId: string) {
  const [order] = await getDb().select().from(paymentOrders).where(eq(paymentOrders.id, id)).limit(1);
  if (!order) throw new AppError("ORDER_NOT_FOUND", "Orden no encontrada.", 404);
  assertTransition(order.status, "issued");
  const token = randomToken();
  await getDb().update(paymentOrders).set({ status: "issued", issuedAt: new Date(), publicTokenHash: hashToken(token), publicExpiresAt: new Date(Date.now() + 30 * 86400000), updatedBy: userId, version: order.version + 1 }).where(and(eq(paymentOrders.id, id), eq(paymentOrders.version, order.version)));
  return token;
}

export async function markOrderPaid(id: string, userId: string, idempotencyKey: string) {
  return getDb().transaction(async (tx) => {
    const [existing] = await tx.select().from(payments).where(eq(payments.idempotencyKey, idempotencyKey)).limit(1);
    if (existing) return existing.id;
    const [order] = await tx.select().from(paymentOrders).where(eq(paymentOrders.id, id)).limit(1);
    if (!order) throw new AppError("ORDER_NOT_FOUND", "Orden no encontrada.", 404);
    assertTransition(order.status, "paid");
    const paymentId = randomUUID();
    await tx.insert(payments).values({ id: paymentId, paymentOrderId: id, idempotencyKey, amount: order.total, currency: order.currency, method: "manual", paidAt: new Date(), recordedBy: userId });
    await tx.update(paymentOrders).set({ status: "paid", paidAt: new Date(), updatedBy: userId, version: order.version + 1 }).where(and(eq(paymentOrders.id, id), eq(paymentOrders.version, order.version)));
    return paymentId;
  });
}

export async function findPublicOrder(token: string) {
  const [row] = await getDb().select({ number: paymentOrders.number, status: paymentOrders.status, total: paymentOrders.total, dueAt: paymentOrders.dueAt, clientName: clients.legalName })
    .from(paymentOrders).innerJoin(clients, eq(clients.id, paymentOrders.clientId))
    .where(and(
      eq(paymentOrders.publicTokenHash, hashToken(token)),
      inArray(paymentOrders.status, ["issued", "paid", "invoiced"]),
      gt(paymentOrders.publicExpiresAt, new Date()),
      isNull(paymentOrders.publicRevokedAt),
    )).limit(1);
  return row ?? null;
}
