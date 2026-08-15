import { and, asc, eq, gt, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { clients, paymentOrderLines, paymentOrders } from "@/db/schema";
import { hashToken } from "@/lib/security";
import { toLegacyPaymentOrder, type OrderPdfHeader } from "./pdf";

const headerSelection = {
  id: paymentOrders.id,
  number: paymentOrders.number,
  status: paymentOrders.status,
  subtotal: paymentOrders.subtotal,
  discountTotal: paymentOrders.discountTotal,
  taxTotal: paymentOrders.taxTotal,
  createdAt: paymentOrders.createdAt,
  issuedAt: paymentOrders.issuedAt,
  dueAt: paymentOrders.dueAt,
  clientName: clients.legalName,
  clientTaxId: clients.taxId,
  clientEmail: clients.email,
};

async function assemble(header: OrderPdfHeader | undefined) {
  if (!header) return null;
  const lines = await getDb().select({
    id: paymentOrderLines.id,
    code: paymentOrderLines.code,
    description: paymentOrderLines.description,
    quantity: paymentOrderLines.quantity,
    subtotal: paymentOrderLines.subtotal,
  }).from(paymentOrderLines).where(eq(paymentOrderLines.paymentOrderId, header.id)).orderBy(asc(paymentOrderLines.sortOrder));
  return toLegacyPaymentOrder(header, lines);
}

export async function findOrderPdf(id: string) {
  const [header] = await getDb().select(headerSelection).from(paymentOrders)
    .innerJoin(clients, eq(clients.id, paymentOrders.clientId)).where(eq(paymentOrders.id, id)).limit(1);
  return assemble(header);
}

export async function findPublicOrderPdf(token: string) {
  const [header] = await getDb().select(headerSelection).from(paymentOrders)
    .innerJoin(clients, eq(clients.id, paymentOrders.clientId))
    .where(and(
      eq(paymentOrders.publicTokenHash, hashToken(token)),
      inArray(paymentOrders.status, ["issued", "paid", "invoiced"]),
      gt(paymentOrders.publicExpiresAt, new Date()),
      isNull(paymentOrders.publicRevokedAt),
    )).limit(1);
  return assemble(header);
}
