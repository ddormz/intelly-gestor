import { listInvoices, listPaidOrdersWithoutInvoice } from "@/features/billing/service";
import { requireUser } from "@/features/auth/session";
import { getIntellyDteGateway } from "@/features/integrations/intellydte";
import { BillingManager } from "./billing-manager";
import { parsePageQuery } from "@/lib/list-query";

export default async function BillingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const query = parsePageQuery(raw);
  const gateway = await getIntellyDteGateway();
  const [items, ready, user, folios] = await Promise.all([
    listInvoices(query),
    listPaidOrdersWithoutInvoice(),
    requireUser(),
    gateway.getFoliosStatus(),
  ]);
  return (
    <BillingManager
      canImport={user.role === "admin"}
      query={query}
      page={items.page}
      pageSize={items.pageSize}
      total={items.total}
      folios={folios}
      items={items.items.map((item) => ({
        id: item.id,
        orderNumber: item.orderNumber,
        clientName: item.clientName,
        clientEmail: item.clientEmail,
        total: item.total,
        status: item.status,
        folio: item.folio,
        siiStatus: item.siiStatus,
        siiGlosa: item.siiGlosa,
        hasPdf: Boolean(item.hasPdf),
        hasXml: Boolean(item.hasXml),
      }))}
      ready={ready}
    />
  );
}
