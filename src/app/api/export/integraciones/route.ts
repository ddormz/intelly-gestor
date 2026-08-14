import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { integrationAttempts } from "@/db/schema";
import { requireUser } from "@/features/auth/session";
import { serializeCsv } from "@/lib/csv";

export async function GET() {
  await requireUser("admin");
  const rows = await getDb().select({ createdAt: integrationAttempts.createdAt, integration: integrationAttempts.integration, operation: integrationAttempts.operation, status: integrationAttempts.status, correlationId: integrationAttempts.correlationId, safeMessage: integrationAttempts.safeMessage }).from(integrationAttempts).orderBy(desc(integrationAttempts.createdAt)).limit(5_000);
  const body = serializeCsv(["fecha", "integracion", "operacion", "estado", "correlacion", "mensaje_seguro"], rows.map((row) => [row.createdAt.toISOString(), row.integration, row.operation, row.status, row.correlationId, row.safeMessage]));
  return new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=integraciones-intelly.csv", "Cache-Control": "no-store" } });
}
