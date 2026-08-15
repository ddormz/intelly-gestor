import { and, asc, eq, like, or } from "drizzle-orm";
import { getDb } from "@/db";
import { catalogItems, clients } from "@/db/schema";

const SEARCH_LIMIT = 20;

export async function searchActiveClients(query: string) {
  const normalized = query.trim().slice(0, 120);
  const conditions = [eq(clients.status, "active")];
  if (normalized) {
    const value = `%${normalized}%`;
    conditions.push(or(like(clients.taxId, value), like(clients.legalName, value))!);
  }
  return getDb().select({ id: clients.id, legalName: clients.legalName, taxId: clients.taxId, email: clients.email })
    .from(clients).where(and(...conditions)).orderBy(asc(clients.legalName), asc(clients.id)).limit(SEARCH_LIMIT).execute();
}

export async function searchActiveCatalog(query: string) {
  const normalized = query.trim().slice(0, 120);
  const conditions = [eq(catalogItems.status, "active")];
  if (normalized) {
    const value = `%${normalized}%`;
    conditions.push(or(like(catalogItems.code, value), like(catalogItems.name, value))!);
  }
  return getDb().select({ id: catalogItems.id, code: catalogItems.code, name: catalogItems.name, type: catalogItems.type, unitPrice: catalogItems.unitPrice, taxCategory: catalogItems.taxCategory, taxRate: catalogItems.taxRate })
    .from(catalogItems).where(and(...conditions)).orderBy(asc(catalogItems.name), asc(catalogItems.id)).limit(SEARCH_LIMIT).execute();
}
