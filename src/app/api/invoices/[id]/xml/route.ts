import { requireUser } from "@/features/auth/session";
import { regenerateInvoicePdf } from "@/features/billing/emission";
import { getFiscalEvidenceArtifact } from "@/features/billing/evidence";
import { AppError, safeError } from "@/lib/errors";

export const runtime = "nodejs";

function safeFolio(value: unknown): string {
  return String(value ?? "").replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 60) || "factura";
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    let artifact = await getFiscalEvidenceArtifact(id, "signed_xml");
    if (!artifact?.bytes) {
      try {
        await regenerateInvoicePdf(id, user.userId);
        artifact = await getFiscalEvidenceArtifact(id, "signed_xml");
      } catch {
        // fall through to 404
      }
    }
    if (!artifact?.bytes) {
      return new Response("Evidencia XML no encontrada.", {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    const body = new ArrayBuffer(artifact.bytes.byteLength);
    new Uint8Array(body).set(artifact.bytes);
    const charset = artifact.encoding?.trim() || "ISO-8859-1";
    return new Response(body, {
      headers: {
        "Content-Type": `application/xml; charset=${charset}`,
        "Content-Disposition": `attachment; filename="factura-${safeFolio(artifact.folio)}.xml"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error && String((error as { digest: string }).digest).startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    const safe = safeError(error);
    const status = error instanceof AppError ? error.status : 500;
    return new Response(safe.message, {
      status,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
