import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { clients } from "@/db/schema";

export function listClients() {
  return getDb().select().from(clients).where(eq(clients.status, "active")).orderBy(asc(clients.legalName)).limit(200);
}
