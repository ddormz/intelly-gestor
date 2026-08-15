import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db";
import { issueInvoice } from "@/features/billing/emission";
import type { IntellyDteGateway } from "@/features/integrations/intellydte";

vi.mock("@/db", () => ({ getDb: vi.fn() }));
vi.mock("@/features/integrations/config-service", () => ({ getIntellyDteConfig: vi.fn(async () => ({ baseUrl: "https://dte.example", tenantApiKey: "ik_tenant", systemApiKey: "isk_system", tenantRut: "12345678-5", apiKey: "ik_tenant" })), getIntellyDteWebhookSecret: vi.fn() }));
vi.mock("@/features/billing/evidence", () => ({ storeSignedXmlBytes: vi.fn(async () => ({ id: "xml-evidence", kind: "signed_xml", storageKey: "xml", sha256: "xml-hash", mimeType: "application/xml", dteType: "33", folio: "42", rendererVersion: null, version: 1, invoiceId: "invoice-1", createdAt: new Date() })), storeReconstructedPdf: vi.fn(async () => ({ id: "pdf-evidence", kind: "reconstructed_pdf", storageKey: "pdf", sha256: "pdf-hash", mimeType: "application/pdf", dteType: "33", folio: "42", rendererVersion: "fiscal-pdf-v2", version: 1, invoiceId: "invoice-1", createdAt: new Date() })) }));
vi.mock("@/features/billing/xml", () => ({ parseSignedDteXmlBytes: vi.fn(() => ({ type: "33", folio: 42, issueDate: "2026-08-15", dueDate: null, issuer: { rut: "76123456-7", name: "EMISOR", businessLine: null, activity: null, address: null, commune: null, city: null }, receiver: { rut: "12345678-5", name: "CLIENTE SPA", businessLine: "Comercio", address: "Destino", commune: "Providencia", city: "Santiago" }, details: [{ lineNumber: 1, name: "Servicio", description: null, quantity: 2, unit: null, unitPrice: 500, amount: 1000, exempt: false, discountPercent: null, discountAmount: 0 }], totals: { net: 1000, exempt: 0, ivaRate: 19, iva: 190, total: 1190 }, references: [], resolution: { date: null, number: null }, tedXml: "<TED/>", sourceXml: "xml" })), renderFiscalPdf: vi.fn(async () => new Uint8Array(Buffer.from("%PDF-fiscal"))) }));
vi.mock("@/features/audit/service", () => ({ buildAuditEvent: vi.fn((input) => ({ id: "audit", correlationId: "corr", metadata: input.metadata })) }));

function builder<T>(result: T) {
  const chain = { from: vi.fn(() => chain), innerJoin: vi.fn(() => chain), where: vi.fn(() => chain), limit: vi.fn(() => chain), orderBy: vi.fn(() => chain), execute: vi.fn(async () => result) };
  return chain;
}

function configuredDb(existing: unknown[], attempts: unknown[]) {
  const selects = [builder([{ id: "order-1", number: "OP-1", status: "paid", subtotal: "1000", total: "1190", taxTotal: "190", discountTotal: "0", notes: null, clientId: "client-1", clientTaxId: "12345678-5", clientName: "CLIENTE SPA", clientGiro: "Comercio", clientAddress: "Destino", clientCommune: "Providencia", clientCity: "Santiago", clientEmail: "client@example.com" }]), builder([{ description: "Servicio", quantity: "2", unitPrice: "500", subtotal: "1000", discountAmount: "0", taxRate: "19", taxAmount: "190", total: "1190", sortOrder: 0 }]), builder(existing), builder(attempts)];
  const db = {
    select: vi.fn(() => selects.shift() ?? builder([])),
    insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) })),
    transaction: vi.fn(async (callback: (tx: typeof db) => unknown) => callback(db)),
  };
  vi.mocked(getDb).mockReturnValue(db as never);
  return db;
}

describe("fiscal emission orchestration", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "mysql://user:pass@localhost:3306/app";
    process.env.INTELLYDTE_MODE = "http";
  });

  it("creates one attempt and materializes both evidence artifacts for an issued provider response", async () => {
    const db = configuredDb([], []);
    const issue = vi.fn(async () => ({ kind: "issued" as const, providerDocumentId: "dte-1", folio: "42", issuedAt: "2026-08-15T12:00:00.000Z", signedXmlBase64: Buffer.from("signed").toString("base64"), siiStatus: "ENQUEUED" }));
    const gateway = { issueInvoice: issue, getInvoiceStatus: vi.fn(), health: vi.fn(), lookupRut: vi.fn() } as unknown as IntellyDteGateway;

    const result = await issueInvoice("order-1", "user-1", gateway);

    expect(result.kind).toBe("issued");
    expect(issue).toHaveBeenCalledOnce();
    const inserted = db.insert.mock.calls.map(([table]) => table);
    expect(inserted.length).toBeGreaterThanOrEqual(2);
    expect(gateway.getInvoiceStatus).not.toHaveBeenCalled();
  });

  it("reconciles an uncertain provider identifier before any second create call", async () => {
    configuredDb([{ id: "invoice-1", paymentOrderId: "order-1", status: "pending", providerDocumentId: "dte-1", folio: null, tenantRut: "76123456-7", trackId: null, siiStatus: null, siiGlosa: null, signedXmlEvidenceId: null, reconstructedPdfEvidenceId: null, evidenceStatus: "pending", evidenceError: null, issuedAt: null }], [{ attemptNumber: 1 }]);
    const issue = vi.fn();
    const status = vi.fn(async () => ({ kind: "pending" as const, providerDocumentId: "dte-1", providerCode: "IDEMPOTENCY_IN_PROGRESS" }));
    const gateway = { issueInvoice: issue, getInvoiceStatus: status, health: vi.fn(), lookupRut: vi.fn() } as unknown as IntellyDteGateway;

    const result = await issueInvoice("order-1", "user-1", gateway);

    expect(result).toMatchObject({ kind: "pending", providerDocumentId: "dte-1" });
    expect(issue).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith("dte-1");
  });
});
