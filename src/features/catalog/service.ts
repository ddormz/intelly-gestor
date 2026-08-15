import { and, asc, count, eq, like, or, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { catalogItems } from "@/db/schema";
import type { PageQuery, PageResult } from "@/lib/list-query";

type CatalogItem = typeof catalogItems["$inferSelect"];

export function listCatalogItems(): Promise<CatalogItem[]>;
export function listCatalogItems(query: PageQuery): Promise<PageResult<CatalogItem>>;
export async function listCatalogItems(query?: PageQuery): Promise<CatalogItem[] | PageResult<CatalogItem>> {
  const db = getDb();
  const base = db.select().from(catalogItems);
  if (!query) return base.orderBy(asc(catalogItems.name), asc(catalogItems.id)).execute();

  const conditions: SQL[] = [];
  if (query.q) {
    const search = `%${query.q}%`;
    conditions.push(or(like(catalogItems.code, search), like(catalogItems.name, search), like(catalogItems.description, search))!);
  }
  const status = query.status === "active" || query.status === "inactive"
    ? query.status
    : query.tab === "active" || query.tab === "inactive" ? query.tab : undefined;
  if (status) conditions.push(eq(catalogItems.status, status));
  if (query.type === "product" || query.type === "service" || query.type === "project") conditions.push(eq(catalogItems.type, query.type));
  const where = conditions.length ? and(...conditions) : undefined;
  const itemsQuery = where ? base.where(where) : base;
  const [items, [{ value: total }]] = await Promise.all([
    itemsQuery.orderBy(asc(catalogItems.name), asc(catalogItems.id)).limit(query.pageSize).offset((query.page - 1) * query.pageSize).execute(),
    (where ? db.select({ value: count() }).from(catalogItems).where(where) : db.select({ value: count() }).from(catalogItems)).execute(),
  ]);
  return { items, page: query.page, pageSize: query.pageSize, total: Number(total) };
}

export function listActiveCatalogItems() {
  return getDb().select().from(catalogItems).where(eq(catalogItems.status, "active")).orderBy(asc(catalogItems.name), asc(catalogItems.id)).limit(500).execute();
}

export async function hasActiveCatalogItem(): Promise<boolean> {
  const [item] = await getDb().select({ id: catalogItems.id }).from(catalogItems).where(eq(catalogItems.status, "active")).limit(1).execute();
  return Boolean(item);
}
