import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db";
import { issueInvoice, refreshInvoiceStatus } from "@/features/billing/emission";
import type { IntellyDteGateway } from "@/features/integrations/intellydte";
import { renderFiscalPdf } from "@/features/billing/xml";

vi.mock("@/db", () => ({ getDb: vi.fn() }));
vi.mock("@/features/integrations/config-service", () => ({ getIntellyDteConfig: vi.fn(async () => ({ baseUrl: "https://dte.example", tenantApiKey: "ik_tenant", systemApiKey: "isk_system", tenantRut: "76123456-0", apiKey: "ik_tenant" })), getIntellyDteWebhookSecret: vi.fn() }));
vi.mock("@/features/billing/evidence", () => ({ getFiscalEvidenceArtifact: vi.fn(async () => ({ id: "xml-evidence", bytes: new Uint8Array(Buffer.from("signed")) })), storeSignedXmlBytes: vi.fn(async () => ({ id: "xml-evidence", kind: "signed_xml", storageKey: "xml", sha256: "xml-hash", mimeType: "application/xml", dteType: "33", folio: "42", rendererVersion: null, version: 1, invoiceId: "invoice-1", createdAt: new Date() })), storeReconstructedPdf: vi.fn(async () => ({ id: "pdf-evidence", kind: "reconstructed_pdf", storageKey: "pdf", sha256: "pdf-hash", mimeType: "application/pdf", dteType: "33", folio: "42", rendererVersion: "fiscal-pdf-v2", version: 1, invoiceId: "invoice-1", createdAt: new Date() })) }));
vi.mock("@/features/billing/xml", () => ({ parseSignedDteXmlBytes: vi.fn(() => ({ type: "33", folio: 42, issueDate: "2026-08-15", dueDate: null, issuer: { rut: "76123456-0", name: "EMISOR", businessLine: null, activity: null, address: null, commune: null, city: null }, receiver: { rut: "12345678-5", name: "CLIENTE SPA", businessLine: "Comercio", address: "Destino", commune: "Providencia", city: "Santiago" }, details: [{ lineNumber: 1, name: "Servicio", description: null, quantity: 2, unit: null, unitPrice: 500, amount: 1000, exempt: false, discountPercent: null, discountAmount: 0 }], totals: { net: 1000, exempt: 0, ivaRate: 19, iva: 190, total: 1190 }, references: [], resolution: { date: null, number: null }, tedXml: "<TED/>", sourceXml: "xml" })), renderFiscalPdf: vi.fn(async () => new Uint8Array(Buffer.from("%PDF-fiscal"))) }));
vi.mock("@/features/audit/service", () => ({ buildAuditEvent: vi.fn((input) => ({ id: "audit", correlationId: "corr", metadata: input.metadata })) }));

function builder<T>(result: T) {
  const chain = { from: vi.fn(() => chain), innerJoin: vi.fn(() => chain), where: vi.fn(() => chain), limit: vi.fn(() => chain), orderBy: vi.fn(() => chain), execute: vi.fn(async () => result) };
  return chain;
}

function configuredDb(existing: unknown[], attempts: unknown[], orderStatus: "draft" | "issued" | "paid" = "paid") {
  const selects = [builder([{ id: "order-1", number: "OP-1", status: orderStatus, subtotal: "1000", total: "1190", taxTotal: "190", discountTotal: "0", notes: null, clientId: "client-1", clientTaxId: "12345678-5", clientName: "CLIENTE SPA", clientGiro: "Comercio", clientAddress: "Destino", clientCommune: "Providencia", clientCity: "Santiago", clientEmail: "client@example.com" }]), builder([{ description: "Servicio", quantity: "2", unitPrice: "500", subtotal: "1000", discountAmount: "0", taxRate: "19", taxAmount: "190", total: "1190", sortOrder: 0 }]), builder(existing), builder(attempts)];
  const updates: Array<Record<string, unknown>> = [];
  const db = {
    select: vi.fn(() => selects.shift() ?? builder([])),
    insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
    update: vi.fn(() => ({ set: vi.fn((value: Record<string, unknown>) => { updates.push(value); return { where: vi.fn(async () => undefined) }; }) })),
    transaction: vi.fn(async (callback: (tx: typeof db) => unknown) => callback(db)),
  };
  vi.mocked(getDb).mockReturnValue(db as never);
  return { ...db, updates };
}

describe("fiscal emission orchestration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T12:00:00.000Z"));
    vi.mocked(renderFiscalPdf).mockReset();
    vi.mocked(renderFiscalPdf).mockResolvedValue(new Uint8Array(Buffer.from("%PDF-fiscal")));
    process.env.DATABASE_URL = "mysql://user:pass@localhost:3306/app";
    process.env.INTELLYDTE_MODE = "http";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("materializes the PDF immediately but waits for SII confirmation before issuing locally", async () => {
    const db = configuredDb([], []);
    const issue = vi.fn(async () => ({ kind: "issued" as const, providerDocumentId: "dte-1", folio: "42", issuedAt: "2026-08-15T12:00:00.000Z", signedXmlBase64: Buffer.from("signed").toString("base64"), siiStatus: "ENQUEUED" }));
    const gateway = { issueInvoice: issue, getInvoiceStatus: vi.fn(), health: vi.fn(), lookupRut: vi.fn() } as unknown as IntellyDteGateway;

    const result = await issueInvoice("order-1", "user-1", gateway);

    expect(result.kind).toBe("issued");
    expect(issue).toHaveBeenCalledOnce();
    const inserted = db.insert.mock.calls.map(([table]) => table);
    expect(inserted.length).toBeGreaterThanOrEqual(2);
    expect(gateway.getInvoiceStatus).not.toHaveBeenCalled();
    expect(db.updates).toContainEqual(expect.objectContaining({ status: "processing", evidenceStatus: "complete" }));
    expect(db.updates.some((value) => value.invoicedAt)).toBe(false);
  });

  it("can emit an invoice directly from an issued order", async () => {
    const db = configuredDb([], [], "issued");
    const issue = vi.fn(async () => ({ kind: "issued" as const, providerDocumentId: "dte-issued-order", folio: "44", issuedAt: "2026-08-15T12:00:00.000Z", signedXmlBase64: Buffer.from("signed").toString("base64"), siiStatus: "DOK" }));
    const gateway = { issueInvoice: issue, getInvoiceStatus: vi.fn(), health: vi.fn(), lookupRut: vi.fn() } as unknown as IntellyDteGateway;

    const result = await issueInvoice("order-1", "user-1", gateway);

    expect(result).toMatchObject({ kind: "issued", folio: "44", siiStatus: "DOK" });
    expect(issue).toHaveBeenCalledOnce();
    expect(db.updates).toContainEqual(expect.objectContaining({ status: "invoiced" }));
  });

  it("can emit an invoice directly from a draft order without issuing the order first", async () => {
    const db = configuredDb([], [], "draft");
    const issue = vi.fn(async () => ({ kind: "issued" as const, providerDocumentId: "dte-draft-order", folio: "45", issuedAt: "2026-08-15T12:00:00.000Z", signedXmlBase64: Buffer.from("signed").toString("base64"), siiStatus: "DOK" }));
    const gateway = { issueInvoice: issue, getInvoiceStatus: vi.fn(), health: vi.fn(), lookupRut: vi.fn() } as unknown as IntellyDteGateway;

    const result = await issueInvoice("order-1", "user-1", gateway);

    expect(result).toMatchObject({ kind: "issued", folio: "45", siiStatus: "DOK" });
    expect(issue).toHaveBeenCalledOnce();
    expect(db.updates).toContainEqual(expect.objectContaining({ publicTokenHash: expect.any(String), publicTokenCiphertext: expect.any(String) }));
    expect(db.updates).toContainEqual(expect.objectContaining({ status: "invoiced" }));
  });

  it("keeps an SII-accepted invoice issued when the signed XML is still pending", async () => {
    const db = configuredDb([], []);
    const gateway = {
      issueInvoice: vi.fn(async () => ({
        kind: "issued" as const,
        providerDocumentId: "dte-accepted-without-xml",
        folio: "43",
        issuedAt: "2026-08-15T12:00:00.000Z",
        siiStatus: "DOK",
        siiGlosa: "Documento aceptado",
      })),
      getInvoiceStatus: vi.fn(),
      health: vi.fn(),
      lookupRut: vi.fn(),
    } as unknown as IntellyDteGateway;

    const result = await issueInvoice("order-1", "user-1", gateway);

    expect(result).toMatchObject({ kind: "issued", providerDocumentId: "dte-accepted-without-xml", folio: "43", siiStatus: "DOK" });
    expect(db.transaction).toHaveBeenCalledOnce();
  });

  it("keeps the invoice issued but marks evidence failed when PDF reconstruction fails", async () => {
    const db = configuredDb([], []);
    vi.mocked(renderFiscalPdf).mockRejectedValueOnce(new Error("renderer failed"));
    const gateway = {
      issueInvoice: vi.fn(async () => ({
        kind: "issued" as const,
        providerDocumentId: "dte-pdf-failure",
        folio: "42",
        issuedAt: "2026-08-15T12:00:00.000Z",
        signedXmlBase64: Buffer.from("signed").toString("base64"),
        siiStatus: "ENQUEUED",
      })),
      getInvoiceStatus: vi.fn(),
      health: vi.fn(),
      lookupRut: vi.fn(),
    } as unknown as IntellyDteGateway;

    const result = await issueInvoice("order-1", "user-1", gateway);

    expect(result.kind).toBe("issued");
    expect(db.updates).toContainEqual(expect.objectContaining({ status: "processing", evidenceStatus: "failed" }));
  });

  it("reconciles an uncertain provider identifier before any second create call", async () => {
    configuredDb([{ id: "invoice-1", paymentOrderId: "order-1", status: "pending", providerDocumentId: "dte-1", folio: null, tenantRut: "76123456-0", trackId: null, siiStatus: null, siiGlosa: null, signedXmlEvidenceId: null, reconstructedPdfEvidenceId: null, evidenceStatus: "pending", evidenceError: null, issuedAt: null }], [{ attemptNumber: 1 }]);
    const issue = vi.fn();
    const status = vi.fn(async () => ({ kind: "pending" as const, providerDocumentId: "dte-1", providerCode: "IDEMPOTENCY_IN_PROGRESS" }));
    const gateway = { issueInvoice: issue, getInvoiceStatus: status, health: vi.fn(), lookupRut: vi.fn() } as unknown as IntellyDteGateway;

    const result = await issueInvoice("order-1", "user-1", gateway);

    expect(result).toMatchObject({ kind: "pending", providerDocumentId: "dte-1" });
    expect(issue).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith("dte-1");
  });

  it("retries a pre-folio provider failure with the same fiscal request and keeps it pending", async () => {
    const db = configuredDb([{ id: "invoice-1", paymentOrderId: "order-1", status: "rejected", providerDocumentId: null, folio: null, tenantRut: "76123456-0", trackId: null, siiStatus: null, siiGlosa: null, signedXmlEvidenceId: null, reconstructedPdfEvidenceId: null, evidenceStatus: "pending", evidenceError: null, issuedAt: null, rejectedAt: new Date(), lastErrorCode: "ASYNC_SII_UPLOAD_DISABLED", lastErrorMessage: "Async deshabilitado" }], [{ attemptNumber: 1 }]);
    const issue = vi.fn(async () => ({ kind: "failed" as const, code: "ASYNC_SII_UPLOAD_DISABLED", safeMessage: "Async deshabilitado", retryable: false, statusCode: 409 }));
    const gateway = { issueInvoice: issue, getInvoiceStatus: vi.fn(), health: vi.fn(), lookupRut: vi.fn() } as unknown as IntellyDteGateway;

    const result = await issueInvoice("order-1", "user-1", gateway);

    expect(result).toMatchObject({ kind: "failed", code: "ASYNC_SII_UPLOAD_DISABLED" });
    expect(issue).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: "invoice:order-1", orderNumber: "OP-1", emissionMode: "async" }));
    expect(gateway.getInvoiceStatus).not.toHaveBeenCalled();
    expect(db.updates).toContainEqual(expect.objectContaining({ status: "pending", rejectedAt: null, lastErrorCode: "ASYNC_SII_UPLOAD_DISABLED" }));
  });

  it("does not re-emit a document that has an actual SII rejection", async () => {
    configuredDb([{ id: "invoice-1", paymentOrderId: "order-1", status: "rejected", providerDocumentId: "dte-rejected", folio: "51", tenantRut: "76123456-0", trackId: null, siiStatus: "RPR", siiGlosa: "Documento rechazado", signedXmlEvidenceId: null, reconstructedPdfEvidenceId: null, evidenceStatus: "pending", evidenceError: null, issuedAt: null, lastErrorCode: "SII_REJECTED", lastErrorMessage: "Documento rechazado" }], []);
    const issue = vi.fn();
    const gateway = { issueInvoice: issue, getInvoiceStatus: vi.fn(), health: vi.fn(), lookupRut: vi.fn() } as unknown as IntellyDteGateway;

    const result = await issueInvoice("order-1", "user-1", gateway);

    expect(result).toMatchObject({ kind: "rejected", code: "SII_REJECTED", folio: "51" });
    expect(issue).not.toHaveBeenCalled();
    expect(gateway.getInvoiceStatus).not.toHaveBeenCalled();
  });

  it("rebuilds a missing PDF from stored XML without calling IntellyDTE", async () => {
    const invoice = { id: "invoice-1", paymentOrderId: "order-1", status: "issued", providerDocumentId: "dte-1", folio: "42", tenantRut: "76123456-0", trackId: null, siiStatus: "DOK", siiGlosa: "Documento aceptado", signedXmlEvidenceId: "xml-evidence", reconstructedPdfEvidenceId: null, evidenceStatus: "pending", evidenceError: "PDF pendiente", issuedAt: new Date("2026-08-15T12:00:00.000Z") };
    const selects = [builder([invoice]), builder([{ subtotal: "1000", total: "1190", taxTotal: "190", discountTotal: "0", notes: null, clientTaxId: "12345678-5", clientName: "CLIENTE SPA", clientGiro: "Comercio", clientAddress: "Destino", clientCommune: "Providencia", clientCity: "Santiago", clientEmail: "client@example.com" }]), builder([{ description: "Servicio", quantity: "2", unitPrice: "500", subtotal: "1000", discountAmount: "0", taxRate: "19", taxAmount: "190", total: "1190", sortOrder: 0 }]), builder([])];
    const updates: Array<Record<string, unknown>> = [];
    const db = {
      select: vi.fn(() => selects.shift() ?? builder([])),
      insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
      update: vi.fn(() => ({ set: vi.fn((value: Record<string, unknown>) => {
        updates.push(value);
        return { where: vi.fn(async () => undefined) };
      }) })),
      transaction: vi.fn(async (callback: (tx: typeof db) => unknown) => callback(db)),
    };
    vi.mocked(getDb).mockReturnValue(db as never);
    const status = vi.fn(async () => ({ kind: "pending" as const, providerDocumentId: "dte-1" }));
    const gateway = { issueInvoice: vi.fn(), getInvoiceStatus: status, health: vi.fn(), lookupRut: vi.fn() } as unknown as IntellyDteGateway;

    const result = await refreshInvoiceStatus("invoice-1", "user-1", gateway);

    expect(result).toMatchObject({ kind: "issued", providerDocumentId: "dte-1", folio: "42" });
    expect(status).not.toHaveBeenCalled();
    expect(updates).toContainEqual(expect.objectContaining({ evidenceStatus: "complete", reconstructedPdfEvidenceId: "pdf-evidence" }));
  });
});
