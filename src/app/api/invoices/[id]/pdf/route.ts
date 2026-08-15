import { requireUser } from "@/features/auth/session";
import { getFiscalEvidenceArtifact } from "@/features/billing/evidence";

export const runtime = "nodejs";

function safeFolio(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 60) || "factura";
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const artifact = await getFiscalEvidenceArtifact(id, "reconstructed_pdf");
  if (!artifact?.bytes) return new Response("Evidencia PDF no encontrada.", { status: 404 });
  const body = new ArrayBuffer(artifact.bytes.byteLength);
  new Uint8Array(body).set(artifact.bytes);
  return new Response(body, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="factura-${safeFolio(artifact.folio)}.pdf"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
