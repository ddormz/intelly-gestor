import { listInvoices, listPaidOrdersWithoutInvoice } from "@/features/billing/service";
import { requireUser } from "@/features/auth/session";
import { BillingManager } from "./billing-manager";
import { parsePageQuery } from "@/lib/list-query";

export default async function BillingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const query = parsePageQuery(raw);
  const [items, ready, user] = await Promise.all([
    listInvoices(query),
    listPaidOrdersWithoutInvoice(),
    requireUser(),
  ]);
  return (
    <BillingManager
      canImport={user.role === "admin"}
      query={query}
      page={items.page}
      pageSize={items.pageSize}
      total={items.total}
      items={items.items.map((item) => ({
        id: item.id,
        orderId: item.orderId,
        orderNumber: item.orderNumber,
        clientName: item.clientName,
        clientEmail: item.clientEmail,
        total: item.total,
        status: item.status,
        providerDocumentId: item.providerDocumentId,
        folio: item.folio,
        siiStatus: item.siiStatus,
        siiGlosa: item.siiGlosa,
        lastErrorCode: item.lastErrorCode,
        lastErrorMessage: item.lastErrorMessage,
        hasPdf: Boolean(item.hasPdf),
        hasXml: Boolean(item.hasXml),
      }))}
      ready={ready}
    />
  );
}
