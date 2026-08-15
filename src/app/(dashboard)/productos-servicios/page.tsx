import { listCatalogItems } from "@/features/catalog/service";
import { CatalogManager } from "./catalog-manager";
import { requireUser } from "@/features/auth/session";
import { parsePageQuery } from "@/lib/list-query";

export default async function CatalogPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [raw, user] = await Promise.all([searchParams, requireUser()]);
   const query = parsePageQuery(raw, { allowedTabs: ["active", "inactive", "all"], defaultTab: "active" });
  const result = await listCatalogItems(query);
   return <CatalogManager canImport={user.role === "admin"} query={query} page={result.page} pageSize={result.pageSize} total={result.total} items={result.items.map((item) => ({ id: item.id, type: item.type, code: item.code, name: item.name, description: item.description, unitPrice: item.unitPrice, taxCategory: item.taxCategory, status: item.status }))} />;
}
