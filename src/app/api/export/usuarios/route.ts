import { requireUser } from "@/features/auth/session";
import { listUsersForAdmin } from "@/features/auth/admin-service";
import { serializeUsersCsv, usersCsvTemplate } from "@/features/auth/users-csv";

export async function GET(request: Request) {
  await requireUser("admin");
  const template = new URL(request.url).searchParams.get("template") === "1";
  const body = template ? usersCsvTemplate() : serializeUsersCsv(await listUsersForAdmin());
  return new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${template ? "plantilla-usuarios" : "usuarios-intelly"}.csv"`, "Cache-Control": "no-store" } });
}
