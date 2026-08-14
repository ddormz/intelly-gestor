import { requireUser } from "@/features/auth/session";
import { historicalInvoicesTemplate, serializeInvoicesCsv } from "@/features/billing/csv";
import { listInvoices } from "@/features/billing/service";

export async function GET(request: Request) {
  await requireUser();
  const template = new URL(request.url).searchParams.get("template") === "1";
  const body = template ? historicalInvoicesTemplate() : serializeInvoicesCsv(await listInvoices());
  return new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${template ? "plantilla-facturas-historicas" : "facturacion-intelly"}.csv"`, "Cache-Control": "no-store" } });
}
