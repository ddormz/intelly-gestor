import { beforeEach, describe, expect, it, vi } from "vitest";
import { IntellyDteHttpGateway } from "@/features/integrations/intellydte";

const signedXmlBase64 = Buffer.from("<DTE><Documento/></DTE>").toString("base64");

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("typed IntellyDTE gateway", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("emits DTE 33 using the local headers and normalizes printPayload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ success: true, data: { dteRecordId: "dte-1", tipoDte: "33", folio: 42, trackId: null, siiStatus: "ENQUEUED", printPayload: { signedXmlBase64 } } }));
    vi.stubGlobal("fetch", fetchMock);
    const gateway = new IntellyDteHttpGateway({ baseUrl: "https://dte.example", tenantApiKey: "ik_tenant", systemApiKey: "isk_system", tenantRut: "76123456-7", emissionMode: "async", timeoutMs: 1000 });

    const result = await gateway.issueInvoice({ idempotencyKey: "invoice:order-1", correlationId: "corr-1", orderNumber: "OP-1", total: "1190", recipientTaxId: "76123456-7", payload: { receptor: { rut: "76123456-7", razonSocial: "Cliente" }, items: [], montoNeto: 1000, montoIva: 190, montoTotal: 1190 } });

    expect(fetchMock).toHaveBeenCalledWith("https://dte.example/api/v1/dte/factura", expect.objectContaining({ method: "POST", headers: expect.objectContaining({ "x-api-key": "ik_tenant", "x-tenant-rut": "76123456-7", "Idempotency-Key": "invoice:order-1", "x-intelly-emission-mode": "async" }) }));
    expect(result).toMatchObject({ kind: "issued", providerDocumentId: "dte-1", folio: "42", trackId: null, siiStatus: "ENQUEUED", signedXmlBase64 });
  });

  it("maps authorization, conflict, provider, timeout, and malformed responses safely", async () => {
    const gateway = new IntellyDteHttpGateway({ baseUrl: "https://dte.example", tenantApiKey: "ik_tenant", systemApiKey: "isk_system", tenantRut: "76123456-7", emissionMode: "async", timeoutMs: 1000 });
    const command = { idempotencyKey: "invoice:order-1", correlationId: "corr-1", orderNumber: "OP-1", total: "1190", recipientTaxId: "76123456-7", payload: { receptor: { rut: "76123456-7", razonSocial: "Cliente" }, items: [], montoTotal: 1190 } };
    for (const [status, expected] of [[401, "INTELLYDTE_UNAUTHORIZED"], [409, "INTELLYDTE_CONFLICT"], [500, "INTELLYDTE_UNAVAILABLE"], [400, "INVALID_INVOICE"]] as const) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ error: { code: expected, message: "provider" } }, status)));
      const result = await gateway.issueInvoice(command);
      expect(result.kind).toBe(status === 500 ? "pending" : "rejected");
    }
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("timed out", "TimeoutError")));
    expect((await gateway.issueInvoice(command)).kind).toBe("pending");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not-json", { status: 200 })));
    expect((await gateway.issueInvoice(command)).kind).toBe("unavailable");
  });

  it("uses the provider status route without creating a second invoice", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ success: true, data: { dteRecordId: "dte-1", folio: 42, trackId: "track-1", siiStatus: "ACEPTADO", siiGlosa: "OK" } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await new IntellyDteHttpGateway({ baseUrl: "https://dte.example", tenantApiKey: "ik_tenant", systemApiKey: "isk_system", tenantRut: "76123456-7", emissionMode: "async", timeoutMs: 1000 }).getInvoiceStatus("dte-1");
    expect(fetchMock).toHaveBeenCalledWith("https://dte.example/api/v1/integrations/dte/dte-1/status", expect.objectContaining({ method: "GET", headers: expect.objectContaining({ "x-api-key": "isk_system", "x-tenant-rut": "76123456-7" }) }));
    expect(result).toMatchObject({ kind: "issued", providerDocumentId: "dte-1", trackId: "track-1", siiStatus: "ACEPTADO" });
  });

  it("probes the provider root health endpoint and classifies idempotency-in-progress as pending", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response({ success: true }, 200)).mockResolvedValueOnce(response({ error: { code: "IDEMPOTENCY_IN_PROGRESS", message: "in progress" } }, 409));
    vi.stubGlobal("fetch", fetchMock);
    const gateway = new IntellyDteHttpGateway({ baseUrl: "https://dte.example/api/v1", tenantApiKey: "ik_tenant", systemApiKey: "isk_system", tenantRut: "76123456-7", emissionMode: "async", timeoutMs: 1000 });
    await gateway.health();
    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://dte.example/health", expect.any(Object));
    const result = await gateway.issueInvoice({ idempotencyKey: "invoice:order-1", correlationId: "corr-1", orderNumber: "OP-1", total: "1190", recipientTaxId: "76123456-7", payload: { receptor: { rut: "76123456-7", razonSocial: "Cliente" }, items: [], montoTotal: 1190 } });
    expect(result).toMatchObject({ kind: "pending", providerCode: "IDEMPOTENCY_IN_PROGRESS", providerDocumentId: undefined });
  });

  it.each([["DOK", "issued"], ["SOA", "pending"], ["RPR", "rejected"], ["DNK", "rejected"], ["FAN", "rejected"], ["RCT", "rejected"]] as const)("classifies SII status %s as %s", async (siiStatus, kind) => {
    const fetchMock = vi.fn().mockResolvedValue(response({ success: true, data: { dteRecordId: "dte-1", folio: 42, siiStatus, siiGlosa: "provider status" } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await new IntellyDteHttpGateway({ baseUrl: "https://dte.example", tenantApiKey: "ik_tenant", systemApiKey: "isk_system", tenantRut: "76123456-7", emissionMode: "async", timeoutMs: 1000 }).getInvoiceStatus("dte-1");
    expect(result.kind).toBe(kind);
  });

  it("preserves request identifiers and provider code from a 409 replay or in-progress response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ error: { code: "IDEMPOTENCY_IN_PROGRESS", message: "processing" }, data: { dteRecordId: "dte-409", folio: 77, siiStatus: "SOA" } }, 409)));
    const result = await new IntellyDteHttpGateway({ baseUrl: "https://dte.example", tenantApiKey: "ik_tenant", systemApiKey: "isk_system", tenantRut: "76123456-7", emissionMode: "async", timeoutMs: 1000 }).issueInvoice({ idempotencyKey: "invoice:order-1", correlationId: "corr-1", orderNumber: "OP-1", total: "1190", recipientTaxId: "76123456-7", payload: { receptor: { rut: "76123456-7", razonSocial: "Cliente" }, items: [], montoTotal: 1190 } });
    expect(result).toMatchObject({ kind: "pending", providerDocumentId: "dte-409", folio: "77", providerCode: "IDEMPOTENCY_IN_PROGRESS", siiStatus: "SOA" });
  });

  it("queries folios status across DTE 33, 39, and 61 and requests new folios from IntellyDTE", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ success: true, data: [{ tipoDte: 33, disponibles: 42, rangoDesde: 1, rangoHasta: 100 }, { tipoDte: 39, disponibles: 5, rangoDesde: 101, rangoHasta: 200 }, { tipoDte: 61, disponibles: 0 }] }))
      .mockResolvedValueOnce(response({ success: true, data: { tipoDte: 33, cantidadOtorgada: 50, rangoDesde: 101, rangoHasta: 150, message: "CAF descargado" } }));
    vi.stubGlobal("fetch", fetchMock);

    const gateway = new IntellyDteHttpGateway({ baseUrl: "https://dte.example", tenantApiKey: "ik_tenant", systemApiKey: "isk_system", tenantRut: "76123456-7", emissionMode: "async", timeoutMs: 1000 });
    const folios = await gateway.getFoliosStatus();
    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://dte.example/api/v1/folios/status", expect.objectContaining({ method: "GET", headers: expect.objectContaining({ "x-api-key": "ik_tenant" }) }));
    expect(folios).toHaveLength(3);
    expect(folios.find((f) => f.tipoDte === 33)).toMatchObject({ disponibles: 42, alerta: "normal" });
    expect(folios.find((f) => f.tipoDte === 39)).toMatchObject({ disponibles: 5, alerta: "low" });
    expect(folios.find((f) => f.tipoDte === 61)).toMatchObject({ disponibles: 0, alerta: "critical" });

    const requestResult = await gateway.requestFolios({ tipoDte: 33, cantidad: 50 });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://dte.example/api/v1/folios/request", expect.objectContaining({ method: "POST", body: JSON.stringify({ tipoDte: 33, cantidad: 50 }) }));
    expect(requestResult).toMatchObject({ ok: true, tipoDte: 33, cantidadOtorgada: 50, rangoDesde: 101, rangoHasta: 150 });
  });
});
