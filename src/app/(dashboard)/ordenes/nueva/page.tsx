import { requireUser } from "@/features/auth/session";
import { findActiveClient } from "@/features/clients/service";
import { createOrderFromCartAction } from "@/features/orders/actions";
import { OrderPos } from "./order-pos";

export default async function NewOrderPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireUser();
  const raw = await searchParams;
  const clientId = Array.isArray(raw.clientId) ? raw.clientId[0] : raw.clientId;
  const client = clientId ? await findActiveClient(clientId) : null;
  return <OrderPos action={createOrderFromCartAction} initial={client ? { clientId: client.id, clientName: client.legalName, clientTaxId: client.taxId, clientEmail: client.email } : undefined} />;
}
