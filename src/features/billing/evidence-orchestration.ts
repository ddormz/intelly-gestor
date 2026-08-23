import { AppError } from "@/lib/errors";
import type { IntellyDteFacturaPayload } from "@/features/integrations/intellydte-contract";
import type { InvoiceResult } from "@/features/integrations/intellydte";
import { parseSignedDteXmlBytes, renderFiscalPdf, type ParsedDteDocument } from "./xml";
import { storeReconstructedPdf, storeSignedXmlBytes } from "./evidence";

export type EvidenceMaterializationResult = {
  status: "pending" | "complete" | "failed";
  signedXmlEvidenceId: string | null;
  reconstructedPdfEvidenceId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
};

export type MaterializeInvoiceEvidenceInput = {
  invoiceId: string;
  result: Extract<InvoiceResult, { kind: "issued" }>;
  payload: IntellyDteFacturaPayload;
  expectedIssuerRut?: string | null;
};

function errorCode(error: unknown, fallback: string): string {
  if (error instanceof AppError) return error.code;
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") return error.code;
  return fallback;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof AppError ? error.message.slice(0, 300) : fallback;
}

function decodeProviderXml(value: string): Uint8Array {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 === 1) {
    throw new AppError("SIGNED_XML_INVALID", "El XML firmado de IntellyDTE no es base64 válido.", 502);
  }
  const bytes = new Uint8Array(Buffer.from(value, "base64"));
  if (!bytes.byteLength) throw new AppError("SIGNED_XML_INVALID", "El XML firmado de IntellyDTE está vacío.", 502);
  return bytes;
}

function normalizeRut(value: string): string {
  const compact = value.replace(/[^0-9kK]/g, "").toUpperCase();
  return compact.length > 1 ? `${compact.slice(0, -1)}-${compact.slice(-1)}` : compact;
}

export function assertProviderMatchesOrder(
  result: Extract<InvoiceResult, { kind: "issued" }>,
  document: ParsedDteDocument,
  payload: IntellyDteFacturaPayload,
  expectedIssuerRut?: string | null,
): void {
  if (document.type !== "33" || result.tipoDte && result.tipoDte !== "33" || result.printPayload?.signedXmlBase64 && result.printPayload.signedXmlBase64 !== result.signedXmlBase64) {
    throw new AppError("SIGNED_XML_DTE_TYPE_MISMATCH", "El XML firmado no corresponde a una Factura 33.", 502);
  }
  if (String(document.folio) !== String(result.folio)) throw new AppError("SIGNED_XML_FOLIO_MISMATCH", "El folio del XML firmado no coincide con IntellyDTE.", 502);
  if (expectedIssuerRut && normalizeRut(document.issuer.rut) !== normalizeRut(expectedIssuerRut)) throw new AppError("SIGNED_XML_ISSUER_MISMATCH", "El emisor del XML firmado no coincide con la configuración fiscal.", 502);
  if (normalizeRut(document.receiver.rut) !== normalizeRut(payload.receptor.rut) || document.receiver.name.trim() !== payload.receptor.razonSocial.trim()) throw new AppError("SIGNED_XML_RECEIVER_MISMATCH", "El receptor del XML firmado no coincide con la orden.", 502);
  if (document.totals.net !== (payload.montoNeto ?? 0) || document.totals.exempt !== (payload.montoExento ?? 0) || document.totals.iva !== (payload.montoIva ?? 0) || document.totals.total !== payload.montoTotal) throw new AppError("SIGNED_XML_TOTALS_MISMATCH", "Los totales del XML firmado no coinciden con la orden.", 502);
  if (payload.fechaEmision && document.issueDate !== payload.fechaEmision) throw new AppError("SIGNED_XML_DATE_MISMATCH", "La fecha del XML firmado no coincide con la orden.", 502);
  if (document.details.length !== payload.items.length) throw new AppError("SIGNED_XML_DETAIL_COUNT_MISMATCH", "El detalle del XML firmado no coincide con la orden.", 502);
  document.details.forEach((detail, index) => {
    const item = payload.items[index]!;
    if (detail.name.trim() !== item.nombre.trim() || detail.quantity !== item.cantidad || detail.unitPrice !== item.precioUnitario || detail.amount !== item.montoItem || detail.discountAmount !== (item.descuentoMonto ?? 0) || detail.exempt !== Boolean(item.exento)) throw new AppError("SIGNED_XML_DETAIL_MISMATCH", "Una línea del XML firmado no coincide con la orden.", 502);
  });
}

function failedResult(error: unknown, fallbackCode: string, fallbackMessage: string, signedXmlEvidenceId: string | null = null): EvidenceMaterializationResult {
  return {
    status: "failed",
    signedXmlEvidenceId,
    reconstructedPdfEvidenceId: null,
    errorCode: errorCode(error, fallbackCode),
    errorMessage: errorMessage(error, fallbackMessage),
  };
}

export async function materializeInvoiceEvidence(input: MaterializeInvoiceEvidenceInput): Promise<EvidenceMaterializationResult> {
  if (!input.result.signedXmlBase64) {
    return {
      status: "pending",
      signedXmlEvidenceId: null,
      reconstructedPdfEvidenceId: null,
      errorCode: "SIGNED_XML_PENDING",
      errorMessage: "La factura fue aceptada; falta almacenar el XML firmado.",
    };
  }

  let bytes: Uint8Array;
  let document: ParsedDteDocument;
  try {
    bytes = decodeProviderXml(input.result.signedXmlBase64);
    document = parseSignedDteXmlBytes(bytes);
    assertProviderMatchesOrder(input.result, document, input.payload, input.expectedIssuerRut);
  } catch (error) {
    return failedResult(error, "SIGNED_XML_INVALID", "No se pudo validar el XML firmado.");
  }

  let signedXmlEvidenceId: string;
  try {
    const signed = await storeSignedXmlBytes(input.invoiceId, { dteType: document.type, folio: document.folio }, bytes);
    signedXmlEvidenceId = signed.id;
  } catch (error) {
    return failedResult(error, "SIGNED_XML_STORAGE_FAILED", "No se pudo guardar el XML firmado.");
  }

  try {
    const pdf = await renderFiscalPdf(document);
    const reconstructed = await storeReconstructedPdf(input.invoiceId, { dteType: document.type, folio: document.folio, rendererVersion: "fiscal-pdf-v2" }, pdf);
    return { status: "complete", signedXmlEvidenceId, reconstructedPdfEvidenceId: reconstructed.id, errorCode: null, errorMessage: null };
  } catch (error) {
    return failedResult(error, "PDF_RECONSTRUCTION_FAILED", "No se pudo reconstruir el PDF fiscal.", signedXmlEvidenceId);
  }
}
