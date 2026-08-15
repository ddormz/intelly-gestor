import { listClients } from "@/features/clients/service";
import { ClientManager } from "./client-manager";
import { requireUser } from "@/features/auth/session";
import { parsePageQuery } from "@/lib/list-query";

export default async function ClientsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [raw, user] = await Promise.all([searchParams, requireUser()]);
    const query = parsePageQuery(raw, { allowedTabs: ["active", "inactive", "all"], defaultTab: "active" });
  const rawReturnTo = Array.isArray(raw.returnTo) ? raw.returnTo[0] : raw.returnTo;
  const returnTo = rawReturnTo?.startsWith("/") && !rawReturnTo.startsWith("//") ? rawReturnTo : undefined;
  const result = await listClients(query);
    return <ClientManager returnTo={returnTo} canImport={user.role === "admin"} query={query} page={result.page} pageSize={result.pageSize} total={result.total} items={result.items.map((item) => ({ id: item.id, kind: item.kind, taxId: item.taxId, legalName: item.legalName, giro: item.giro, email: item.email, phone: item.phone, addressLine: item.addressLine, region: item.region, commune: item.commune, city: item.city, status: item.status }))} />;
}
