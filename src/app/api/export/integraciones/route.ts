import { listIntegrationAttempts } from "@/features/audit/service";
import { requireUser } from "@/features/auth/session";
import { serializeCsv } from "@/lib/csv";

export async function GET() {
  await requireUser("admin");
  const rows = await listIntegrationAttempts();
  const body = serializeCsv(["fecha", "integracion", "operacion", "estado", "correlacion", "mensaje_seguro"], rows.map((row) => [row.createdAt.toISOString(), row.integration, row.operation, row.status, row.correlationId, row.safeMessage]));
  return new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=integraciones-intelly.csv", "Cache-Control": "no-store" } });
}
