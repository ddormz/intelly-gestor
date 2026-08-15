import { hasActiveCatalogItem } from "@/features/catalog/service";
import { hasActiveClient } from "@/features/clients/service";
import { listOrders } from "@/features/orders/service";
import { canCreateOrder } from "@/features/orders/domain";
import { requireUser } from "@/features/auth/session";
import { parsePageQuery } from "@/lib/list-query";
import { OrderManager } from "./order-manager";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const query = parsePageQuery(raw);
  const publicLink = Array.isArray(raw.publicLink) ? raw.publicLink[0] : raw.publicLink;
   const [orders, hasClient, hasCatalog, user] = await Promise.all([listOrders(query), hasActiveClient(), hasActiveCatalogItem(), requireUser()]);
    return <OrderManager publicLink={publicLink} query={query} page={orders.page} pageSize={orders.pageSize} total={orders.total} canImport={user.role === "admin"} canCreate={canCreateOrder(hasClient, hasCatalog)} orders={orders.items.map((order) => ({ id: order.id, number: order.number, clientName: order.clientName, clientEmail: order.clientEmail, status: order.status, total: order.total }))} />;
}
