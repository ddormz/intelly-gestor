import { createHash } from "node:crypto";
import { getEnv } from "@/lib/env";
import { getIntellyDteConfig } from "./config-service";

export type IssueInvoiceCommand = {
  idempotencyKey: string;
  correlationId: string;
  orderNumber: string;
  total: string;
  recipientTaxId: string;
};

export type InvoiceResult =
  | { kind: "issued"; providerDocumentId: string; folio: string; issuedAt: string }
  | { kind: "rejected"; code: string; safeMessage: string; retryable: false }
  | { kind: "pending"; providerDocumentId?: string; retryAfterSeconds?: number }
  | { kind: "unavailable"; code: string; safeMessage: string; retryable: true };

export interface IntellyDteGateway {
  health(): Promise<{ ok: boolean; checkedAt: string; safeMessage: string }>;
  issueInvoice(command: IssueInvoiceCommand): Promise<InvoiceResult>;
  getInvoiceStatus(providerDocumentId: string): Promise<InvoiceResult>;
}

export class FakeIntellyDteGateway implements IntellyDteGateway {
  async health() { return { ok: true, checkedAt: new Date().toISOString(), safeMessage: "Simulador operativo" }; }
  async issueInvoice(command: IssueInvoiceCommand): Promise<InvoiceResult> {
    const digest = createHash("sha256").update(command.idempotencyKey).digest("hex");
    return { kind: "issued", providerDocumentId: `fake_${digest.slice(0, 16)}`, folio: String(parseInt(digest.slice(0, 8), 16)), issuedAt: new Date().toISOString() };
  }
  async getInvoiceStatus(providerDocumentId: string): Promise<InvoiceResult> {
    return { kind: "issued", providerDocumentId, folio: providerDocumentId.replace(/\D/g, "").slice(0, 8) || "1", issuedAt: new Date().toISOString() };
  }
}

class ClosedHttpGateway implements IntellyDteGateway {
  private unavailable(): InvoiceResult { return { kind: "unavailable", code: "CONTRACT_REQUIRED", safeMessage: "Falta configurar el contrato oficial de IntellyDTE.", retryable: true }; }
  async health() { return { ok: false, checkedAt: new Date().toISOString(), safeMessage: "Contrato oficial pendiente" }; }
  async issueInvoice(): Promise<InvoiceResult> { return this.unavailable(); }
  async getInvoiceStatus(): Promise<InvoiceResult> { return this.unavailable(); }
}

class ConfiguredHttpGateway extends ClosedHttpGateway {
  constructor(private readonly config: { baseUrl: string; apiKey: string }) { super(); }
  async health() {
    const checkedAt = new Date().toISOString();
    try {
      const response = await fetch(this.config.baseUrl, { method: "GET", headers: { Authorization: `Bearer ${this.config.apiKey}`, Accept: "application/json" }, signal: AbortSignal.timeout(getEnv().INTELLYDTE_TIMEOUT_MS), cache: "no-store" });
      if (response.status === 401 || response.status === 403) return { ok: false, checkedAt, safeMessage: "IntellyDTE rechazó la API Key" };
      if (response.status >= 500) return { ok: false, checkedAt, safeMessage: "IntellyDTE no está disponible" };
      return { ok: true, checkedAt, safeMessage: "Base URL y credencial respondieron" };
    } catch {
      return { ok: false, checkedAt, safeMessage: "No fue posible conectar con la Base URL" };
    }
  }
}

export async function getIntellyDteGateway(): Promise<IntellyDteGateway> {
  if (getEnv().INTELLYDTE_MODE === "fake") return new FakeIntellyDteGateway();
  const config = await getIntellyDteConfig();
  return config ? new ConfiguredHttpGateway(config) : new ClosedHttpGateway();
}
