import { requireUser } from "@/features/auth/session";
import { draftOrdersTemplate, serializeOrdersCsv } from "@/features/orders/csv";
import { listOrders } from "@/features/orders/service";

export async function GET(request: Request) {
  await requireUser();
  const template = new URL(request.url).searchParams.get("template") === "1";
  const body = template ? draftOrdersTemplate() : serializeOrdersCsv(await listOrders());
  return new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${template ? "plantilla-ordenes" : "ordenes-intelly"}.csv"`, "Cache-Control": "no-store" } });
}
