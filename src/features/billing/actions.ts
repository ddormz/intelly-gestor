"use server";

import { createHash, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { clients, integrationAttempts, invoices, paymentOrders } from "@/db/schema";
import { requireUser } from "@/features/auth/session";
import { getIntellyDteGateway } from "@/features/integrations/intellydte";
import { AppError } from "@/lib/errors";
import { enforceSameOrigin } from "@/lib/security";
import { readCsvFile } from "@/lib/csv";
import { safeError } from "@/lib/errors";
import type { ActionState } from "@/lib/action-state";
import { parseHistoricalInvoicesCsv } from "./csv";
import { importHistoricalInvoices } from "./service";

export async function issueInvoiceAction(_: ActionState, formData: FormData): Promise<ActionState> {
  await enforceSameOrigin(); await requireUser(); const orderId = String(formData.get("orderId"));
  const [order] = await getDb().select({ id: paymentOrders.id, number: paymentOrders.number, status: paymentOrders.status, total: paymentOrders.total, clientTaxId: clients.taxId })
    .from(paymentOrders).innerJoin(clients, eq(clients.id, paymentOrders.clientId)).where(eq(paymentOrders.id, orderId)).limit(1);
  if (!order || order.status !== "paid") throw new AppError("NOT_INVOICEABLE", "La orden debe estar pagada.", 409);
  const [existing] = await getDb().select().from(invoices).where(eq(invoices.paymentOrderId, orderId)).limit(1);
  if (existing?.status === "issued") return { status: "success", message: "La factura ya estaba emitida." };
  const invoiceId = existing?.id ?? randomUUID(); const key = `invoice:${orderId}`; const correlationId = randomUUID();
  const requestHash = createHash("sha256").update(`${order.number}|${order.total}|${order.clientTaxId}`).digest("hex");
  if (!existing) await getDb().insert(invoices).values({ id: invoiceId, paymentOrderId: orderId, status: "processing", requestHash });
  const attemptId = randomUUID();
  await getDb().insert(integrationAttempts).values({ id: attemptId, integration: "intellydte", operation: "issue_invoice", aggregateType: "invoice", aggregateId: invoiceId, idempotencyKey: key, correlationId, attemptNumber: 1, status: "processing", requestHash });
  const result = await (await getIntellyDteGateway()).issueInvoice({ idempotencyKey: key, correlationId, orderNumber: order.number, total: order.total, recipientTaxId: order.clientTaxId ?? "" });
  if (result.kind === "issued") {
    await getDb().transaction(async (tx) => {
      await tx.update(invoices).set({ status: "issued", providerDocumentId: result.providerDocumentId, folio: result.folio, issuedAt: new Date(result.issuedAt) }).where(eq(invoices.id, invoiceId));
      await tx.update(paymentOrders).set({ status: "invoiced", invoicedAt: new Date() }).where(and(eq(paymentOrders.id, orderId), eq(paymentOrders.status, "paid")));
      await tx.update(integrationAttempts).set({ status: "issued", completedAt: new Date(), providerCode: result.providerDocumentId }).where(eq(integrationAttempts.id, attemptId));
    });
  } else {
    await getDb().update(invoices).set({ status: result.kind === "rejected" ? "rejected" : "pending", lastErrorCode: result.kind === "pending" ? null : result.code, lastErrorMessage: result.kind === "pending" ? "Emisión pendiente" : result.safeMessage }).where(eq(invoices.id, invoiceId));
    await getDb().update(integrationAttempts).set({ status: result.kind, completedAt: new Date(), safeMessage: result.kind === "pending" ? "Pendiente" : result.safeMessage }).where(eq(integrationAttempts.id, attemptId));
  }
  revalidatePath("/facturacion"); revalidatePath("/");
  return { status: "success", message: result.kind === "issued" ? "Factura emitida." : "Solicitud de facturación registrada." };
}

export async function importHistoricalInvoicesAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await enforceSameOrigin();
    const user = await requireUser("admin");
    const rows = parseHistoricalInvoicesCsv(await readCsvFile(formData.get("file")));
    const count = await importHistoricalInvoices(rows, user.userId);
    revalidatePath("/facturacion"); revalidatePath("/ordenes"); revalidatePath("/");
    return { status: "success", message: `${count} facturas históricas importadas por ${user.name}.` };
  } catch (error) {
    return { status: "error", message: safeError(error).message };
  }
}
