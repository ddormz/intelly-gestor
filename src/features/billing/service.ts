import { createHash, randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditEvents, clients, invoices, paymentOrders } from "@/db/schema";
import { buildAuditEvent } from "@/features/audit/service";
import { AppError } from "@/lib/errors";
import type { HistoricalInvoiceCsvRow } from "./csv";

export function listInvoices() {
  return getDb().select({ id: invoices.id, orderId: paymentOrders.id, orderNumber: paymentOrders.number, clientName: clients.legalName, total: paymentOrders.total, status: invoices.status, folio: invoices.folio, createdAt: invoices.createdAt })
    .from(invoices).innerJoin(paymentOrders, eq(paymentOrders.id, invoices.paymentOrderId)).innerJoin(clients, eq(clients.id, paymentOrders.clientId)).orderBy(desc(invoices.createdAt)).limit(100);
}

export function listPaidOrdersWithoutInvoice() {
  return getDb().select({ id: paymentOrders.id, number: paymentOrders.number, total: paymentOrders.total, clientName: clients.legalName })
    .from(paymentOrders).innerJoin(clients, eq(clients.id, paymentOrders.clientId)).where(eq(paymentOrders.status, "paid")).limit(100);
}

export async function importHistoricalInvoices(rows: HistoricalInvoiceCsvRow[], actorUserId: string): Promise<number> {
  const [orders, existingInvoices] = await Promise.all([
    getDb().select().from(paymentOrders),
    getDb().select({ orderId: invoices.paymentOrderId, providerDocumentId: invoices.providerDocumentId }).from(invoices),
  ]);
  const ordersByNumber = new Map(orders.map((order) => [order.number, order]));
  const usedOrders = new Set(existingInvoices.map((invoice) => invoice.orderId));
  const usedProviderIds = new Set(existingInvoices.map((invoice) => invoice.providerDocumentId).filter(Boolean));
  const resolved = rows.map((row, index) => {
    const order = ordersByNumber.get(row.orderNumber);
    if (!order || order.status !== "paid") throw new AppError("CSV_ORDER_NOT_PAID", `Fila ${index + 2}: la orden no existe o no está pagada.`);
    if (usedOrders.has(order.id)) throw new AppError("CSV_INVOICE_EXISTS", `Fila ${index + 2}: la orden ya tiene una factura.`);
    if (usedProviderIds.has(row.providerDocumentId)) throw new AppError("CSV_PROVIDER_ID_EXISTS", `Fila ${index + 2}: el ID externo ya existe.`);
    usedOrders.add(order.id); usedProviderIds.add(row.providerDocumentId);
    return { order, row };
  });
  await getDb().transaction(async (tx) => {
    for (const { order, row } of resolved) {
      const requestHash = createHash("sha256").update(`historical|${order.number}|${row.providerDocumentId}`).digest("hex");
      await tx.insert(invoices).values({ id: randomUUID(), paymentOrderId: order.id, status: "issued", providerDocumentId: row.providerDocumentId, folio: row.folio, requestHash, issuedAt: row.issuedAt });
      await tx.update(paymentOrders).set({ status: "invoiced", invoicedAt: row.issuedAt, updatedAt: new Date() }).where(eq(paymentOrders.id, order.id));
    }
    await tx.insert(auditEvents).values(buildAuditEvent({ actorUserId, actorType: "user", action: "invoices.historical_imported", entityType: "invoice", metadata: { created: resolved.length } }));
  });
  return resolved.length;
}
