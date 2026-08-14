import { listClients } from "@/features/clients/service";
import { ClientManager } from "./client-manager";
import { requireUser } from "@/features/auth/session";

export default async function ClientsPage() {
  const [items, user] = await Promise.all([listClients(), requireUser()]);
  return <ClientManager canImport={user.role === "admin"} items={items.map((item) => ({ id: item.id, kind: item.kind, taxId: item.taxId, legalName: item.legalName, email: item.email, phone: item.phone, addressLine: item.addressLine, commune: item.commune, city: item.city, status: item.status }))} />;
}
