import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { clients, invoices, paymentOrders } from "@/db/schema";

export function listInvoices() {
  return getDb().select({ id: invoices.id, orderId: paymentOrders.id, orderNumber: paymentOrders.number, clientName: clients.legalName, total: paymentOrders.total, status: invoices.status, folio: invoices.folio, createdAt: invoices.createdAt })
    .from(invoices).innerJoin(paymentOrders, eq(paymentOrders.id, invoices.paymentOrderId)).innerJoin(clients, eq(clients.id, paymentOrders.clientId)).orderBy(desc(invoices.createdAt)).limit(100);
}

export function listPaidOrdersWithoutInvoice() {
  return getDb().select({ id: paymentOrders.id, number: paymentOrders.number, total: paymentOrders.total, clientName: clients.legalName })
    .from(paymentOrders).innerJoin(clients, eq(clients.id, paymentOrders.clientId)).where(eq(paymentOrders.status, "paid")).limit(100);
}
