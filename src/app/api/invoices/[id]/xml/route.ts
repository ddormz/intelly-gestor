import { requireUser } from "@/features/auth/session";
import { getFiscalEvidenceArtifact } from "@/features/billing/evidence";

export const runtime = "nodejs";

function safeFolio(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 60) || "factura";
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const artifact = await getFiscalEvidenceArtifact(id, "signed_xml");
  if (!artifact?.bytes) return new Response("Evidencia XML no encontrada.", { status: 404 });
  const body = new ArrayBuffer(artifact.bytes.byteLength);
  new Uint8Array(body).set(artifact.bytes);
  const charset = artifact.encoding?.trim() || "UTF-8";
  return new Response(body, { headers: { "Content-Type": `application/xml; charset=${charset}`, "Content-Disposition": `attachment; filename="factura-${safeFolio(artifact.folio)}.xml"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
