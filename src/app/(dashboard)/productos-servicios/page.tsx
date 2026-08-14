import { listCatalogItems } from "@/features/catalog/service";
import { CatalogManager } from "./catalog-manager";

export default async function CatalogPage() {
  const items = await listCatalogItems();
  return <CatalogManager items={items.map((item) => ({ id: item.id, type: item.type, code: item.code, name: item.name, description: item.description, unitPrice: item.unitPrice, taxCategory: item.taxCategory, status: item.status }))} />;
}
