import { createHash } from "node:crypto";
import { AppError } from "@/lib/errors";
import { getEnv } from "@/lib/env";
import { getIntellyDteConfig, normalizeIntellyDteBaseUrl, normalizeIntellyDteTenantRut } from "./config-service";
import { providerData, providerError, type IntellyDteFacturaPayload, type NormalizedProviderData, type ProviderBody } from "./intellydte-contract";

export type IssueInvoiceCommand = {
  idempotencyKey: string;
  correlationId: string;
  orderNumber: string;
  total: string;
  recipientTaxId: string;
  payload?: IntellyDteFacturaPayload;
};

type IssuedInvoiceResult = { kind: "issued"; providerDocumentId: string; folio: string; tipoDte?: string; issuedAt: string; trackId?: string | null; siiStatus?: string | null; siiGlosa?: string | null; signedXmlBase64?: string; printPayload?: NormalizedProviderData["printPayload"]; providerBody?: ProviderBody };
export type InvoiceResult = IssuedInvoiceResult | { kind: "rejected"; code: string; safeMessage: string; retryable: false; providerDocumentId?: string; folio?: string; trackId?: string | null; siiStatus?: string | null; siiGlosa?: string | null; providerCode?: string; providerBody?: ProviderBody } | { kind: "pending"; providerDocumentId?: string; folio?: string; trackId?: string | null; siiStatus?: string | null; siiGlosa?: string | null; providerCode?: string; providerBody?: ProviderBody; retryAfterSeconds?: number } | { kind: "unavailable"; code: string; safeMessage: string; retryable: true; providerDocumentId?: string; folio?: string; trackId?: string | null; siiStatus?: string | null; siiGlosa?: string | null; providerCode?: string; providerBody?: ProviderBody };
export type InvoiceStatusResult = InvoiceResult;

export type RutLookupResult = { rut: string; razonSocial: string | null; autorizado: boolean | null };

export interface IntellyDteGateway {
  health(): Promise<{ ok: boolean; checkedAt: string; safeMessage: string }>;
  issueInvoice(command: IssueInvoiceCommand): Promise<InvoiceResult>;
  getInvoiceStatus(providerDocumentId: string): Promise<InvoiceStatusResult>;
  lookupRut(rut: string): Promise<RutLookupResult>;
}

export type GatewayConfig = { baseUrl: string; tenantApiKey?: string; systemApiKey?: string | null; tenantRut?: string | null; apiKey?: string; emissionMode?: "sync" | "async" | "fast-ack"; timeoutMs?: number };

function serviceRoot(value: string): string {
  const url = new URL(value);
  const path = url.pathname.replace(/\/+$/, "").toLowerCase();
  if (path.endsWith("/api/v1")) url.pathname = path.slice(0, -7) || "/";
  else if (path.endsWith("/api")) url.pathname = path.slice(0, -4) || "/";
  else if (path.endsWith("/v1")) url.pathname = path.slice(0, -3) || "/";
  return url.toString().replace(/\/$/, "");
}

function providerStatusRejected(status: string | null | undefined): boolean {
  return Boolean(status && /^(?:RPR|DNK|FAN|RCT)$|REJECT|RECHAZ|FAILED|ERROR|INVALID/i.test(status.trim().toUpperCase()));
}

function providerStatusReview(status: string | null | undefined): boolean {
  return Boolean(status && /^(?:SOA)$|REVIEW|OBSERVED|OBSERVADO/i.test(status.trim().toUpperCase()));
}

function providerStatusAccepted(status: string | null | undefined): boolean {
  return Boolean(status && /^(?:DOK|ACCEPTED|ACEPTADO)$/.test(status.trim().toUpperCase()));
}

function dataResult(data: NormalizedProviderData, fallbackId?: string, requireEvidence = true, body?: ProviderBody): InvoiceResult {
  const providerDocumentId = data.dteRecordId ?? fallbackId;
  if (providerStatusRejected(data.siiStatus)) return { kind: "rejected", code: "SII_REJECTED", safeMessage: data.siiGlosa || "El SII rechazó el documento.", retryable: false, providerDocumentId, providerBody: body };
  if (providerStatusReview(data.siiStatus)) return { kind: "pending", providerDocumentId, folio: data.folio, trackId: data.trackId, siiStatus: data.siiStatus, siiGlosa: data.siiGlosa, providerCode: "SII_REVIEW_REQUIRED", providerBody: body };
  if (providerDocumentId && data.folio && (!requireEvidence || data.printPayload?.signedXmlBase64)) return { kind: "issued", providerDocumentId, folio: data.folio, tipoDte: data.tipoDte, issuedAt: data.issuedAt ?? new Date().toISOString(), trackId: data.trackId, siiStatus: data.siiStatus, siiGlosa: data.siiGlosa, ...(data.printPayload?.signedXmlBase64 ? { signedXmlBase64: data.printPayload.signedXmlBase64 } : {}), printPayload: data.printPayload, providerBody: body };
  if (!requireEvidence && data.siiStatus && !providerStatusAccepted(data.siiStatus)) return { kind: "pending", providerDocumentId, folio: data.folio, trackId: data.trackId, siiStatus: data.siiStatus, siiGlosa: data.siiGlosa, providerCode: "SII_STATUS_UNRESOLVED", providerBody: body };
  if (providerDocumentId || data.folio) return { kind: "pending", providerDocumentId, folio: data.folio, trackId: data.trackId, siiStatus: data.siiStatus, siiGlosa: data.siiGlosa, providerCode: "PROVIDER_EVIDENCE_PENDING", providerBody: body };
  return { kind: "unavailable", code: "INTELLYDTE_INVALID_RESPONSE", safeMessage: "IntellyDTE entregó una respuesta incompleta.", retryable: true, providerBody: body };
}

function payloadForCommand(command: IssueInvoiceCommand): IntellyDteFacturaPayload {
  return command.payload ?? { receptor: { rut: command.recipientTaxId, razonSocial: command.recipientTaxId }, items: [], montoTotal: Math.round(Number(command.total)) };
}

export class IntellyDteHttpGateway implements IntellyDteGateway {
  private readonly root: string;
  private readonly timeoutMs: number;
  private readonly emissionMode: "sync" | "async" | "fast-ack";
  private readonly tenantApiKey: string;
  private readonly systemApiKey: string | null;
  private readonly tenantRut: string | null;

  constructor(private readonly config: GatewayConfig) {
    this.root = serviceRoot(config.baseUrl);
    this.tenantApiKey = config.tenantApiKey ?? config.apiKey ?? "";
    this.systemApiKey = config.systemApiKey ?? null;
    this.tenantRut = config.tenantRut ? normalizeIntellyDteTenantRut(config.tenantRut) : null;
    this.timeoutMs = config.timeoutMs ?? 10_000;
    this.emissionMode = config.emissionMode ?? "async";
  }

  private async request(path: string, init: RequestInit, providerRoot = false): Promise<{ response: Response; body: ProviderBody | null } | { error: InvoiceResult }> {
    try {
      const response = await fetch(`${this.root}${providerRoot ? "" : "/api/v1"}${path}`, { ...init, signal: AbortSignal.timeout(this.timeoutMs), cache: "no-store" });
      try {
        const body = await response.json();
        return { response, body: body && typeof body === "object" ? body as ProviderBody : null };
      } catch {
        return response.ok ? { error: { kind: "unavailable", code: "INTELLYDTE_INVALID_RESPONSE", safeMessage: "IntellyDTE entregó una respuesta inválida.", retryable: true } } : { response, body: null };
      }
    } catch {
      return { error: { kind: "pending", retryAfterSeconds: 30 } };
    }
  }

  async health() {
    const checkedAt = new Date().toISOString();
    const result = await this.request("/health", { method: "GET", headers: { Accept: "application/json" } }, true);
    if ("error" in result) return { ok: false, checkedAt, safeMessage: result.error.kind === "pending" ? "No fue posible conectar con IntellyDTE." : "IntellyDTE no está disponible." };
    if (result.response.status === 401 || result.response.status === 403) return { ok: false, checkedAt, safeMessage: "IntellyDTE rechazó la API Key." };
    return { ok: result.response.ok, checkedAt, safeMessage: result.response.ok ? "IntellyDTE está disponible." : "IntellyDTE no está disponible." };
  }

  async issueInvoice(command: IssueInvoiceCommand): Promise<InvoiceResult> {
    const result = await this.request("/dte/factura", { method: "POST", headers: { "x-api-key": this.tenantApiKey, ...(this.tenantRut ? { "x-tenant-rut": this.tenantRut } : {}), "Idempotency-Key": command.idempotencyKey, "x-intelly-emission-mode": this.emissionMode, "x-intelly-external-sale-id": command.orderNumber, "x-correlation-id": command.correlationId, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payloadForCommand(command)) });
    if ("error" in result) return result.error;
    if (result.response.status >= 500) {
      const data = providerData(result.body);
      return { kind: "pending", providerDocumentId: data.dteRecordId, folio: data.folio, trackId: data.trackId, siiStatus: data.siiStatus, siiGlosa: data.siiGlosa, providerCode: "HTTP_5XX_UNCERTAIN", providerBody: result.body ?? undefined, retryAfterSeconds: 30 };
    }
    if (result.response.status === 401 || result.response.status === 403) return { kind: "rejected", code: "INTELLYDTE_UNAUTHORIZED", safeMessage: "IntellyDTE rechazó la credencial.", retryable: false };
    if (result.response.status === 409) {
      const data = providerData(result.body);
      const error = providerError(result.body, "INTELLYDTE_CONFLICT", "IntellyDTE rechazó la operación duplicada.");
      if (/IDEMPOTENCY.*(PROGRESS|PENDING)|IN_PROGRESS|PROCESSING/i.test(error.code)) return { kind: "pending", providerDocumentId: data.dteRecordId, folio: data.folio, siiStatus: data.siiStatus, siiGlosa: data.siiGlosa, providerCode: error.code, providerBody: result.body ?? undefined, retryAfterSeconds: 30 };
      return data.dteRecordId ? dataResult(data, undefined, true, result.body ?? undefined) : { kind: "rejected", code: error.code, safeMessage: error.message, retryable: false, providerBody: result.body ?? undefined };
    }
    if (result.response.status >= 400) {
      const error = providerError(result.body, "INVALID_INVOICE", "IntellyDTE rechazó la factura.");
      return { kind: "rejected", code: error.code, safeMessage: error.message, retryable: false, providerBody: result.body ?? undefined };
    }
    return dataResult(providerData(result.body), undefined, true, result.body ?? undefined);
  }

  async getInvoiceStatus(providerDocumentId: string): Promise<InvoiceStatusResult> {
    if (!this.systemApiKey) return { kind: "unavailable", code: "SYSTEM_API_KEY_REQUIRED", safeMessage: "Configura la API Key de sistema para consultar estados.", retryable: true };
    const result = await this.request(`/integrations/dte/${encodeURIComponent(providerDocumentId)}/status`, { method: "GET", headers: { "x-api-key": this.systemApiKey, ...(this.tenantRut ? { "x-tenant-rut": this.tenantRut } : {}), Accept: "application/json" } });
    if ("error" in result) return result.error;
    if (!result.response.ok) return result.response.status >= 500 ? { kind: "pending", providerDocumentId, retryAfterSeconds: 30 } : { kind: "unavailable", code: "INTELLYDTE_STATUS_UNAVAILABLE", safeMessage: "No fue posible consultar el estado en IntellyDTE.", retryable: true };
    return dataResult(providerData(result.body), providerDocumentId, false, result.body ?? undefined);
  }

  async lookupRut(rut: string): Promise<RutLookupResult> {
    const result = await this.request(`/rut/${encodeURIComponent(rut)}`, { method: "GET", headers: { "x-api-key": this.tenantApiKey, ...(this.tenantRut ? { "x-tenant-rut": this.tenantRut } : {}), Accept: "application/json" } });
    if ("error" in result) throw new AppError("INTELLYDTE_UNAVAILABLE", "No fue posible conectar con IntellyDTE.", 502);
    if (result.response.status === 400 || result.response.status === 404) throw new AppError("RUT_LOOKUP_INVALID", "IntellyDTE no encontró un RUT válido.", 400);
    if (!result.response.ok) throw new AppError("INTELLYDTE_UNAVAILABLE", "IntellyDTE no está disponible.", 502);
    const root = result.body && typeof result.body === "object" ? result.body as Record<string, unknown> : {};
    const data = root.data && typeof root.data === "object" ? root.data as Record<string, unknown> : root;
    return { rut: typeof data.rut === "string" ? data.rut : rut, razonSocial: typeof data.razonSocial === "string" && data.razonSocial.trim() ? data.razonSocial : null, autorizado: typeof data.autorizado === "boolean" ? data.autorizado : null };
  }
}

function fakeSignedXml(command: IssueInvoiceCommand, folio: string): string {
  const payload = payloadForCommand(command);
  const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]!);
  const date = new Date().toISOString().slice(0, 10);
  const details = payload.items.length ? payload.items.map((item, index) => `<Detalle><NroLinDet>${index + 1}</NroLinDet><NmbItem>${escape(item.nombre)}</NmbItem><QtyItem>${item.cantidad}</QtyItem><PrcItem>${item.precioUnitario}</PrcItem><MontoItem>${item.montoItem}</MontoItem>${item.descuentoMonto ? `<DescuentoMonto>${item.descuentoMonto}</DescuentoMonto>` : ""}${item.descuentoPct ? `<DescuentoPct>${item.descuentoPct}</DescuentoPct>` : ""}</Detalle>`).join("") : `<Detalle><NroLinDet>1</NroLinDet><NmbItem>Servicio</NmbItem><QtyItem>1</QtyItem><PrcItem>${payload.montoTotal}</PrcItem><MontoItem>${payload.montoTotal}</MontoItem></Detalle>`;
  return `<?xml version="1.0" encoding="ISO-8859-1"?><DTE xmlns="http://www.sii.cl/SiiDte"><Documento><Encabezado><IdDoc><TipoDTE>33</TipoDTE><Folio>${folio}</Folio><FchEmis>${date}</FchEmis></IdDoc><Emisor><RUTEmisor>${process.env.INTELLYDTE_COMPANY_TAX_ID || "76123456-7"}</RUTEmisor><RznSoc>INTELLY SPA</RznSoc></Emisor><Receptor><RUTRecep>${escape(payload.receptor.rut)}</RUTRecep><RznSocRecep>${escape(payload.receptor.razonSocial)}</RznSocRecep></Receptor><Totales><MntNeto>${payload.montoNeto ?? payload.montoTotal}</MntNeto><IVA>${payload.montoIva ?? 0}</IVA><MntTotal>${payload.montoTotal}</MntTotal></Totales></Encabezado>${details}<TED version="1.0"><DD><RE>${process.env.INTELLYDTE_COMPANY_TAX_ID || "76123456-7"}</RE><TD>33</TD><F>${folio}</F><FE>${date}</FE><RR>${escape(payload.receptor.rut)}</RR><RSR>${escape(payload.receptor.razonSocial)}</RSR><MNT>${payload.montoTotal}</MNT><IT1>${escape(payload.items[0]?.nombre || "Item")}</IT1><CAF version="1.0"><DA><RE>${process.env.INTELLYDTE_COMPANY_TAX_ID || "76123456-7"}</RE><RS>INTELLY SPA</RS><TD>33</TD><RNG><D>1</D><H>10000</H></RNG><FA>${date}</FA><RSAPK><M>AQAB</M><E>AQAB</E></RSAPK><IDK>100</IDK></DA><FRMA>FAKECALL</FRMA></CAF><TSTED>${date}T12:00:00</TSTED></DD><FRMT>FAKETMST</FRMT></TED></Documento></DTE>`;
}

export class FakeIntellyDteGateway implements IntellyDteGateway {
  async health() { return { ok: true, checkedAt: new Date().toISOString(), safeMessage: "Simulador operativo" }; }
  async issueInvoice(command: IssueInvoiceCommand): Promise<InvoiceResult> {
    const digest = createHash("sha256").update(command.idempotencyKey).digest("hex");
    const providerDocumentId = `fake_${digest.slice(0, 16)}`;
    const folio = String(parseInt(digest.slice(0, 8), 16));
    return { kind: "issued", providerDocumentId, folio, issuedAt: new Date().toISOString(), siiStatus: "ENQUEUED", signedXmlBase64: Buffer.from(fakeSignedXml(command, folio)).toString("base64") };
  }
  async getInvoiceStatus(providerDocumentId: string): Promise<InvoiceResult> { return { kind: "issued", providerDocumentId, folio: providerDocumentId.replace(/\D/g, "").slice(0, 8) || "1", issuedAt: new Date().toISOString(), siiStatus: "ACCEPTED" }; }
  async lookupRut(rut: string): Promise<RutLookupResult> { return { rut, razonSocial: null, autorizado: null }; }
}

class ClosedHttpGateway implements IntellyDteGateway {
  private unavailable(): InvoiceResult { return { kind: "unavailable", code: "CONTRACT_REQUIRED", safeMessage: "Falta configurar el contrato oficial de IntellyDTE.", retryable: true }; }
  async health() { return { ok: false, checkedAt: new Date().toISOString(), safeMessage: "Contrato oficial pendiente" }; }
  async issueInvoice(): Promise<InvoiceResult> { return this.unavailable(); }
  async getInvoiceStatus(): Promise<InvoiceResult> { return this.unavailable(); }
  async lookupRut(): Promise<RutLookupResult> { throw new AppError("INTELLYDTE_NOT_CONFIGURED", "Configura IntellyDTE para consultar el RUT.", 503); }
}

export async function getIntellyDteGateway(): Promise<IntellyDteGateway> {
  if (getEnv().INTELLYDTE_MODE === "fake") return new FakeIntellyDteGateway();
  const config = await getIntellyDteConfig();
  return config ? new IntellyDteHttpGateway({ baseUrl: normalizeIntellyDteBaseUrl(config.baseUrl), tenantApiKey: config.tenantApiKey ?? config.apiKey, systemApiKey: config.systemApiKey, tenantRut: config.tenantRut ?? getEnv().INTELLYDTE_TENANT_RUT ?? getEnv().INTELLYDTE_COMPANY_TAX_ID, emissionMode: getEnv().INTELLYDTE_EMISSION_MODE, timeoutMs: getEnv().INTELLYDTE_TIMEOUT_MS }) : new ClosedHttpGateway();
}

export async function lookupIntellyDteRut(rut: string): Promise<RutLookupResult> {
  const config = await getIntellyDteConfig();
  if (!config) throw new AppError("INTELLYDTE_NOT_CONFIGURED", "Configura IntellyDTE para consultar el RUT.", 503);
  return new IntellyDteHttpGateway({ baseUrl: normalizeIntellyDteBaseUrl(config.baseUrl), tenantApiKey: config.tenantApiKey ?? config.apiKey, systemApiKey: config.systemApiKey, tenantRut: config.tenantRut, timeoutMs: getEnv().INTELLYDTE_TIMEOUT_MS }).lookupRut(rut);
}
