import { and, asc, count, eq, isNull, like, or, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { clients } from "@/db/schema";
import type { PageQuery, PageResult } from "@/lib/list-query";

type Client = typeof clients["$inferSelect"];

export function listClients(): Promise<Client[]>;
export function listClients(query: PageQuery): Promise<PageResult<Client>>;
export async function listClients(query?: PageQuery): Promise<Client[] | PageResult<Client>> {
  const db = getDb();
  const base = db.select().from(clients);
  if (!query) return base.orderBy(asc(clients.legalName), asc(clients.id)).execute();

  const conditions: SQL[] = [];
  if (query.q) {
    const search = `%${query.q}%`;
    conditions.push(or(like(clients.taxId, search), like(clients.legalName, search), like(clients.email, search))!);
  }
  const status = query.status === "active" || query.status === "inactive"
    ? query.status
    : query.tab === "active" || query.tab === "inactive" ? query.tab : undefined;
  if (status) conditions.push(eq(clients.status, status));
  if (query.kind === "person" || query.kind === "company") conditions.push(eq(clients.kind, query.kind));
  const where = conditions.length ? and(...conditions) : undefined;
  const itemsQuery = where ? base.where(where) : base;
  const [items, [{ value: total }]] = await Promise.all([
    itemsQuery.orderBy(asc(clients.legalName), asc(clients.id)).limit(query.pageSize).offset((query.page - 1) * query.pageSize).execute(),
    (where ? db.select({ value: count() }).from(clients).where(where) : db.select({ value: count() }).from(clients)).execute(),
  ]);
  return { items, page: query.page, pageSize: query.pageSize, total: Number(total) };
}

export function listActiveClients() {
  return getDb().select().from(clients).where(or(eq(clients.status, "active"), isNull(clients.status))).orderBy(asc(clients.legalName), asc(clients.id)).limit(500).execute();
}

export async function hasActiveClient(): Promise<boolean> {
  const [client] = await getDb().select({ id: clients.id }).from(clients).where(or(eq(clients.status, "active"), isNull(clients.status))).limit(1).execute();
  return Boolean(client);
}

export async function findActiveClient(id: string) {
  const [client] = await getDb().select({ id: clients.id, legalName: clients.legalName, taxId: clients.taxId, email: clients.email }).from(clients).where(and(eq(clients.id, id), or(eq(clients.status, "active"), isNull(clients.status)))).limit(1).execute();
  return client ?? null;
}
