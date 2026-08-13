import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { catalogItems } from "@/db/schema";

export function listCatalogItems() {
  return getDb().select().from(catalogItems).where(eq(catalogItems.status, "active")).orderBy(asc(catalogItems.name)).limit(200);
}
