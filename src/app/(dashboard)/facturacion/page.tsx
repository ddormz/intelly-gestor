import { listInvoices, listPaidOrdersWithoutInvoice } from "@/features/billing/service";
import { requireUser } from "@/features/auth/session";
import { BillingManager } from "./billing-manager";

export default async function BillingPage() {
  const [items, ready, user] = await Promise.all([listInvoices(), listPaidOrdersWithoutInvoice(), requireUser()]);
  return <BillingManager canImport={user.role === "admin"} items={items.map((item) => ({ id: item.id, orderNumber: item.orderNumber, clientName: item.clientName, total: item.total, status: item.status, folio: item.folio }))} ready={ready} />;
}
