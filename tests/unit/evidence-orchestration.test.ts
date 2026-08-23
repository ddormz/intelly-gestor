import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InvoiceResult } from "@/features/integrations/intellydte";
import type { IntellyDteFacturaPayload } from "@/features/integrations/intellydte-contract";
import type { ParsedDteDocument } from "@/features/billing/xml";

const mocks = vi.hoisted(() => ({
  parseSignedDteXmlBytes: vi.fn(),
  renderFiscalPdf: vi.fn(),
  storeSignedXmlBytes: vi.fn(),
  storeReconstructedPdf: vi.fn(),
}));

vi.mock("@/features/billing/xml", () => ({
  parseSignedDteXmlBytes: mocks.parseSignedDteXmlBytes,
  renderFiscalPdf: mocks.renderFiscalPdf,
}));

vi.mock("@/features/billing/evidence", () => ({
  storeSignedXmlBytes: mocks.storeSignedXmlBytes,
  storeReconstructedPdf: mocks.storeReconstructedPdf,
}));

import { materializeInvoiceEvidence } from "@/features/billing/evidence-orchestration";

const parsedDocument = {
  type: "33",
  folio: 22,
  issueDate: "2026-08-22",
  dueDate: null,
  issuer: { rut: "76123456-7", name: "INTELLY SPA", businessLine: null, activity: null, address: null, commune: null, city: null },
  receiver: { rut: "12345678-5", name: "CLIENTE SPA", businessLine: "Comercio", address: "Destino", commune: "Providencia", city: "Santiago" },
  details: [{ lineNumber: 1, name: "Servicio", description: null, quantity: 2, unit: null, unitPrice: 500, amount: 1000, exempt: false, discountPercent: null, discountAmount: 0 }],
  totals: { net: 1000, exempt: 0, ivaRate: 19, iva: 190, total: 1190 },
  references: [],
  resolution: { date: null, number: null },
  tedXml: "<TED />",
  sourceXml: "<DTE />",
} satisfies ParsedDteDocument;

const payload = {
  receptor: { rut: "12345678-5", razonSocial: "CLIENTE SPA", giro: "Comercio", direccion: "Destino", comuna: "Providencia", ciudad: "Santiago" },
  items: [{ nombre: "Servicio", cantidad: 2, precioUnitario: 500, montoItem: 1000, exento: false }],
  montoNeto: 1000,
  montoIva: 190,
  montoTotal: 1190,
  fechaEmision: "2026-08-22",
} satisfies IntellyDteFacturaPayload;

const issuedResult = {
  kind: "issued" as const,
  providerDocumentId: "dte-101",
  folio: "22",
  tipoDte: "33",
  issuedAt: "2026-08-22T12:00:00.000Z",
  signedXmlBase64: Buffer.from("<DTE />").toString("base64"),
} satisfies Extract<InvoiceResult, { kind: "issued" }>;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.parseSignedDteXmlBytes.mockReturnValue(parsedDocument);
  mocks.renderFiscalPdf.mockResolvedValue(new Uint8Array(Buffer.from("%PDF-fiscal")));
  mocks.storeSignedXmlBytes.mockResolvedValue({ id: "xml-evidence-101" });
  mocks.storeReconstructedPdf.mockResolvedValue({ id: "pdf-evidence-101" });
});

describe("invoice evidence orchestration", () => {
  it("stores XML and generates the fiscal PDF for an issued response", async () => {
    const result = await materializeInvoiceEvidence({
      invoiceId: "invoice-101",
      result: issuedResult,
      payload,
      expectedIssuerRut: "76123456-7",
    });

    expect(result).toEqual({
      status: "complete",
      signedXmlEvidenceId: "xml-evidence-101",
      reconstructedPdfEvidenceId: "pdf-evidence-101",
      errorCode: null,
      errorMessage: null,
    });
    expect(mocks.storeSignedXmlBytes).toHaveBeenCalledWith("invoice-101", expect.objectContaining({ dteType: "33", folio: 22 }), expect.any(Uint8Array));
    expect(mocks.storeReconstructedPdf).toHaveBeenCalledWith("invoice-101", expect.objectContaining({ rendererVersion: "fiscal-pdf-v2", dteType: "33", folio: 22 }), expect.any(Uint8Array));
  });

  it("keeps the XML id and reports a retryable PDF failure", async () => {
    mocks.renderFiscalPdf.mockRejectedValueOnce(new Error("renderer failed"));

    const result = await materializeInvoiceEvidence({ invoiceId: "invoice-101", result: issuedResult, payload, expectedIssuerRut: "76123456-7" });

    expect(result).toMatchObject({
      status: "failed",
      signedXmlEvidenceId: "xml-evidence-101",
      reconstructedPdfEvidenceId: null,
      errorCode: "PDF_RECONSTRUCTION_FAILED",
    });
    expect(mocks.storeReconstructedPdf).not.toHaveBeenCalled();
  });

  it("returns pending without writing artifacts when signed XML is absent", async () => {
    const result = await materializeInvoiceEvidence({
      invoiceId: "invoice-101",
      result: { ...issuedResult, signedXmlBase64: undefined },
      payload,
      expectedIssuerRut: "76123456-7",
    });

    expect(result).toMatchObject({
      status: "pending",
      signedXmlEvidenceId: null,
      reconstructedPdfEvidenceId: null,
      errorCode: "SIGNED_XML_PENDING",
    });
    expect(mocks.storeSignedXmlBytes).not.toHaveBeenCalled();
    expect(mocks.storeReconstructedPdf).not.toHaveBeenCalled();
  });
});
