import { listCatalogItems } from "@/features/catalog/service";
import { CatalogManager } from "./catalog-manager";
import { requireUser } from "@/features/auth/session";

export default async function CatalogPage() {
  const [items, user] = await Promise.all([listCatalogItems(), requireUser()]);
  return <CatalogManager canImport={user.role === "admin"} items={items.map((item) => ({ id: item.id, type: item.type, code: item.code, name: item.name, description: item.description, unitPrice: item.unitPrice, taxCategory: item.taxCategory, status: item.status }))} />;
}
