import { listClients } from "@/features/clients/service";
import { ClientManager } from "./client-manager";

export default async function ClientsPage() {
  const items = await listClients();
  return <ClientManager items={items.map((item) => ({ id: item.id, kind: item.kind, taxId: item.taxId, legalName: item.legalName, email: item.email, phone: item.phone, addressLine: item.addressLine, commune: item.commune, city: item.city, status: item.status }))} />;
}
