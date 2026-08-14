import { requireUser } from "@/features/auth/session";
import { clientCsvTemplate, serializeClientsCsv } from "@/features/clients/csv";
import { listClients } from "@/features/clients/service";

export async function GET(request: Request) {
  await requireUser();
  const template = new URL(request.url).searchParams.get("template") === "1";
  const body = template ? clientCsvTemplate() : serializeClientsCsv(await listClients());
  return new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${template ? "plantilla-clientes" : "clientes-intelly"}.csv"`, "Cache-Control": "no-store" } });
}
