import { createHash, randomUUID } from "node:crypto";
import { and, count, desc, eq, gte, like, lte, or, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { auditEvents, clients, invoices, paymentOrders } from "@/db/schema";
import { buildAuditEvent } from "@/features/audit/service";
import { AppError } from "@/lib/errors";
import type { HistoricalInvoiceCsvRow } from "./csv";
import type { PageQuery, PageResult } from "@/lib/list-query";

const invoiceFields = { id: invoices.id, orderId: paymentOrders.id, orderNumber: paymentOrders.number, clientName: clients.legalName, total: paymentOrders.total, status: invoices.status, folio: invoices.folio, siiStatus: invoices.siiStatus, siiGlosa: invoices.siiGlosa, hasPdf: invoices.reconstructedPdfEvidenceId, hasXml: invoices.signedXmlEvidenceId, createdAt: invoices.createdAt };
type InvoiceListItem = { id: string; orderId: string; orderNumber: string; clientName: string; total: string; status: "pending" | "processing" | "issued" | "rejected"; folio: string | null; siiStatus: string | null; siiGlosa: string | null; hasPdf: string | null; hasXml: string | null; createdAt: Date };

export function listInvoices(): Promise<InvoiceListItem[]>;
export function listInvoices(query: PageQuery): Promise<PageResult<InvoiceListItem>>;
export async function listInvoices(query?: PageQuery): Promise<InvoiceListItem[] | PageResult<InvoiceListItem>> {
  const db = getDb();
  const base = db.select(invoiceFields).from(invoices).innerJoin(paymentOrders, eq(paymentOrders.id, invoices.paymentOrderId)).innerJoin(clients, eq(clients.id, paymentOrders.clientId));
  if (!query) return base.orderBy(desc(invoices.createdAt), desc(invoices.id)).execute();

  const conditions: SQL[] = [];
  if (query.q) {
    const search = `%${query.q}%`;
    conditions.push(or(like(paymentOrders.number, search), like(clients.legalName, search), like(invoices.folio, search), like(invoices.providerDocumentId, search))!);
  }
  const status = query.status ?? query.tab;
  if (status === "pending" || status === "processing" || status === "issued" || status === "rejected") conditions.push(eq(invoices.status, status));
  if (typeof query.from === "string" && /^\d{4}-\d{2}-\d{2}$/.test(query.from)) conditions.push(gte(invoices.createdAt, new Date(`${query.from}T00:00:00.000Z`)));
  if (typeof query.to === "string" && /^\d{4}-\d{2}-\d{2}$/.test(query.to)) conditions.push(lte(invoices.createdAt, new Date(`${query.to}T23:59:59.999Z`)));
  const where = conditions.length ? and(...conditions) : undefined;
  const itemsQuery = where ? base.where(where) : base;
  const [items, [{ value: total }]] = await Promise.all([
    itemsQuery.orderBy(desc(invoices.createdAt), desc(invoices.id)).limit(query.pageSize).offset((query.page - 1) * query.pageSize).execute(),
    (where ? db.select({ value: count() }).from(invoices).innerJoin(paymentOrders, eq(paymentOrders.id, invoices.paymentOrderId)).innerJoin(clients, eq(clients.id, paymentOrders.clientId)).where(where) : db.select({ value: count() }).from(invoices).innerJoin(paymentOrders, eq(paymentOrders.id, invoices.paymentOrderId)).innerJoin(clients, eq(clients.id, paymentOrders.clientId))).execute(),
  ]);
  return { items, page: query.page, pageSize: query.pageSize, total: Number(total) };
}

export function listPaidOrdersWithoutInvoice() {
  return getDb().select({ id: paymentOrders.id, number: paymentOrders.number, total: paymentOrders.total, clientName: clients.legalName })
    .from(paymentOrders).innerJoin(clients, eq(clients.id, paymentOrders.clientId)).where(eq(paymentOrders.status, "paid")).orderBy(desc(paymentOrders.createdAt), desc(paymentOrders.id)).limit(100).execute();
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
