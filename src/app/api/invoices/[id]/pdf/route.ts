import { requireUser } from "@/features/auth/session";
import { regenerateInvoicePdf } from "@/features/billing/emission";
import { getFiscalEvidenceArtifact } from "@/features/billing/evidence";
import { safeError } from "@/lib/errors";

export const runtime = "nodejs";

function safeFolio(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 60) || "factura";
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  let artifact = await getFiscalEvidenceArtifact(id, "reconstructed_pdf");
  if (!artifact?.bytes) {
    try {
      await regenerateInvoicePdf(id, user.userId);
      artifact = await getFiscalEvidenceArtifact(id, "reconstructed_pdf");
    } catch (error) {
      const safe = safeError(error);
      return new Response(safe.message, { status: 409, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
  }
  if (!artifact?.bytes) return new Response("Evidencia PDF no encontrada.", { status: 404 });
  const body = new ArrayBuffer(artifact.bytes.byteLength);
  new Uint8Array(body).set(artifact.bytes);
  return new Response(body, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="factura-${safeFolio(artifact.folio)}.pdf"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
