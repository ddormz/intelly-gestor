import { requireUser } from "@/features/auth/session";
import { getIntellyDteGateway } from "@/features/integrations/intellydte";

export async function GET() {
  await requireUser();
  try {
    const folios = await (await getIntellyDteGateway()).getFoliosStatus();
    return Response.json({ folios }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ message: "No se pudieron cargar los folios CAF." }, { status: 502, headers: { "Cache-Control": "private, no-store" } });
  }
}
