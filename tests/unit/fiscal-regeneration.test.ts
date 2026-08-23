import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db";
import { regenerateInvoicePdf } from "@/features/billing/emission";
import { renderFiscalPdf } from "@/features/billing/xml";

const mocks = vi.hoisted(() => ({
  getFiscalEvidenceArtifact: vi.fn(),
  parseSignedDteXmlBytes: vi.fn(),
  storeReconstructedPdf: vi.fn(),
  buildAuditEvent: vi.fn(),
}));

vi.mock("@/db", () => ({ getDb: vi.fn() }));
vi.mock("@/features/billing/evidence", () => ({
  getFiscalEvidenceArtifact: mocks.getFiscalEvidenceArtifact,
  storeReconstructedPdf: mocks.storeReconstructedPdf,
}));
vi.mock("@/features/billing/xml", () => ({
  parseSignedDteXmlBytes: mocks.parseSignedDteXmlBytes,
  renderFiscalPdf: vi.fn(),
}));
vi.mock("@/features/audit/service", () => ({ buildAuditEvent: mocks.buildAuditEvent }));

const parsedDocument = { type: "33", folio: 42 };
const invoice = {
  id: "invoice-id",
  paymentOrderId: "order-id",
  status: "issued",
  providerDocumentId: "dte-1",
  folio: "42",
  trackId: null,
  siiStatus: "DOK",
  siiGlosa: "Documento aceptado",
  signedXmlEvidenceId: "xml-id",
  reconstructedPdfEvidenceId: "old-pdf-id",
  evidenceStatus: "complete",
  evidenceError: "old error",
  issuedAt: new Date("2026-08-15T12:00:00.000Z"),
};

function chain<T>(result: T) {
  const value = {
    from: vi.fn(() => value),
    innerJoin: vi.fn(() => value),
    where: vi.fn(() => value),
    limit: vi.fn(() => value),
    orderBy: vi.fn(() => value),
    execute: vi.fn(async () => result),
  };
  return value;
}

function configuredDb() {
  const updates: Array<Record<string, unknown>> = [];
  const db = {
    select: vi.fn(() => chain([invoice])),
    update: vi.fn(() => ({
      set: vi.fn((value: Record<string, unknown>) => {
        updates.push(value);
        return { where: vi.fn(async () => undefined) };
      }),
    })),
    insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
  };
  vi.mocked(getDb).mockReturnValue(db as never);
  return { db, updates };
}

describe("manual fiscal PDF regeneration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getFiscalEvidenceArtifact.mockResolvedValue({ id: "xml-id", bytes: new Uint8Array(Buffer.from("signed-xml")) });
    mocks.parseSignedDteXmlBytes.mockReturnValue(parsedDocument);
    vi.mocked(renderFiscalPdf).mockResolvedValue(new Uint8Array(Buffer.from("%PDF-new")));
    mocks.storeReconstructedPdf.mockResolvedValue({ id: "new-pdf-id" });
    mocks.buildAuditEvent.mockReturnValue({ id: "audit-id", correlationId: "correlation-id", metadata: {} });
  });

  it("creates a new reconstructed PDF even when the invoice already has one", async () => {
    const { updates } = configuredDb();

    const result = await regenerateInvoicePdf("invoice-id", "user-id");

    expect(mocks.parseSignedDteXmlBytes).toHaveBeenCalledWith(expect.any(Uint8Array));
    expect(renderFiscalPdf).toHaveBeenCalledWith(parsedDocument);
    expect(mocks.storeReconstructedPdf).toHaveBeenCalledWith(
      "invoice-id",
      { dteType: "33", folio: 42, rendererVersion: "fiscal-pdf-v2" },
      expect.any(Uint8Array),
    );
    expect(updates).toContainEqual(expect.objectContaining({
      reconstructedPdfEvidenceId: "new-pdf-id",
      evidenceStatus: "complete",
      evidenceError: null,
      lastErrorCode: null,
      lastErrorMessage: null,
    }));
    expect(result).toMatchObject({ kind: "issued", providerDocumentId: "dte-1", folio: "42" });
  });

  it("keeps the invoice issued and marks evidence failed when reconstruction fails", async () => {
    const { updates } = configuredDb();
    vi.mocked(renderFiscalPdf).mockRejectedValueOnce(new Error("renderer failed"));

    await expect(regenerateInvoicePdf("invoice-id", "user-id")).rejects.toMatchObject({ code: "PDF_RECONSTRUCTION_FAILED" });

    expect(updates).toContainEqual(expect.objectContaining({ evidenceStatus: "failed", lastErrorCode: "PDF_RECONSTRUCTION_FAILED" }));
    expect(updates.some((value) => value.status === "rejected" || value.status === "pending")).toBe(false);
  });

  it("reconciles with IntellyDTE when the signed XML is not stored yet", async () => {
    const updates: Array<Record<string, unknown>> = [];
    const selects = [
      chain([{ ...invoice, signedXmlEvidenceId: null, reconstructedPdfEvidenceId: null }]),
      chain([{ ...invoice, signedXmlEvidenceId: null, reconstructedPdfEvidenceId: null }]),
      chain([{ subtotal: "1000", total: "1190", taxTotal: "190", discountTotal: "0", notes: null, clientTaxId: "12345678-5", clientName: "CLIENTE SPA", clientGiro: "Comercio", clientAddress: "Destino", clientCommune: "Providencia", clientCity: "Santiago", clientEmail: "client@example.com" }]),
      chain([{ description: "Servicio", quantity: "2", unitPrice: "500", subtotal: "1000", discountAmount: "0", taxRate: "19", taxAmount: "190", total: "1190", sortOrder: 0 }]),
      chain([]),
    ];
    const db = {
      select: vi.fn(() => selects.shift() ?? chain([])),
      insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
      update: vi.fn(() => ({ set: vi.fn((value: Record<string, unknown>) => { updates.push(value); return { where: vi.fn(async () => undefined) }; }) })),
    };
    vi.mocked(getDb).mockReturnValue(db as never);
    const gateway = { getInvoiceStatus: vi.fn(async () => ({ kind: "pending" as const, providerDocumentId: "dte-1", providerCode: "SII_REVIEW_REQUIRED" })) };

    const result = await regenerateInvoicePdf("invoice-id", "user-id", gateway as never);

    expect(result).toMatchObject({ kind: "pending", providerDocumentId: "dte-1" });
    expect(gateway.getInvoiceStatus).toHaveBeenCalledWith("dte-1");
  });
});
