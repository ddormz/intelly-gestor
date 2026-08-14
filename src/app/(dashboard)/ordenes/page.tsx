import { listActiveClients } from "@/features/clients/service";
import { listActiveCatalogItems } from "@/features/catalog/service";
import { listOrders } from "@/features/orders/service";
import { requireUser } from "@/features/auth/session";
import { formatClpAmount } from "@/lib/money";
import { OrderManager } from "./order-manager";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ publicLink?: string }> }) {
  const [{ publicLink }, orders, clients, catalog, user] = await Promise.all([searchParams, listOrders(), listActiveClients(), listActiveCatalogItems(), requireUser()]);
  return <OrderManager publicLink={publicLink} canImport={user.role === "admin"} orders={orders.map((order) => ({ id: order.id, number: order.number, clientName: order.clientName, status: order.status, total: order.total }))} clients={clients.map((client) => ({ id: client.id, name: client.legalName }))} catalog={catalog.map((item) => ({ id: item.id, name: item.name, detail: formatClpAmount(Number(item.unitPrice)) }))} />;
}
