import { requireUser } from "@/features/auth/session";
import { catalogCsvTemplate, serializeCatalogCsv } from "@/features/catalog/csv";
import { listCatalogItems } from "@/features/catalog/service";

export async function GET(request: Request) {
  await requireUser();
  const template = new URL(request.url).searchParams.get("template") === "1";
  const body = template ? catalogCsvTemplate() : serializeCatalogCsv(await listCatalogItems());
  return new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${template ? "plantilla-productos-servicios" : "productos-servicios-intelly"}.csv"`, "Cache-Control": "no-store" } });
}
