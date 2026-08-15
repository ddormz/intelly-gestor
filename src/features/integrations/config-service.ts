import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "@/db";
import { integrationConfigs } from "@/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/encryption";
import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";

const INTEGRATION = "intellydte";

export type IntellyDteConfig = {
  baseUrl: string;
  tenantApiKey: string;
  systemApiKey: string | null;
  tenantRut: string | null;
  /** @deprecated Use tenantApiKey. Kept for the existing RUT lookup contract. */
  apiKey?: string;
};

function encryptionKey(): Buffer {
  const encoded = getEnv().CREDENTIALS_ENCRYPTION_KEY;
  if (!encoded) throw new AppError("ENCRYPTION_NOT_CONFIGURED", "Configura CREDENTIALS_ENCRYPTION_KEY antes de guardar credenciales.");
  return Buffer.from(encoded, "base64");
}

export function maskApiKey(value: string): string {
  return `••••${value.slice(-4)}`;
}

export function normalizeIntellyDteBaseUrl(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new AppError("INVALID_BASE_URL", "Ingresa una Base URL válida."); }
  const allowedHost = url.hostname === "intelly.cl" || url.hostname.endsWith(".intelly.cl") || url.hostname === "intellydte.cl" || url.hostname.endsWith(".intellydte.cl");
  if (url.protocol !== "https:" || !allowedHost) {
    throw new AppError("INVALID_BASE_URL", "La Base URL debe usar HTTPS y pertenecer a Intelly.");
  }
  const path = url.pathname.replace(/\/+$/, "").toLowerCase();
  if (path !== "" && path !== "/api" && path !== "/api/v1" && path !== "/v1") {
    throw new AppError("INVALID_BASE_URL", "La Base URL debe apuntar al servicio raíz de Intelly.");
  }
  url.pathname = "";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

export function validateIntellyDteBaseUrl(value: string): string {
  return normalizeIntellyDteBaseUrl(value);
}

export function normalizeIntellyDteTenantRut(value: string): string {
  const compact = value.replace(/[^0-9kK]/g, "").toUpperCase();
  return compact.length > 1 ? `${compact.slice(0, -1)}-${compact.slice(-1)}` : compact;
}

function decryptStoredSecret(stored: typeof integrationConfigs["$inferSelect"], prefix: "tenantApiKey" | "systemApiKey"): string | null {
  const ciphertext = prefix === "tenantApiKey" ? stored.tenantApiKeyCiphertext : stored.systemApiKeyCiphertext;
  const iv = prefix === "tenantApiKey" ? stored.tenantApiKeyIv : stored.systemApiKeyIv;
  const authTag = prefix === "tenantApiKey" ? stored.tenantApiKeyAuthTag : stored.systemApiKeyAuthTag;
  if (!ciphertext || !iv || !authTag) return null;
  return decryptSecret({ ciphertext, iv, authTag }, encryptionKey());
}

export async function getIntellyDteConfig(): Promise<IntellyDteConfig | null> {
  const [stored] = await getDb().select().from(integrationConfigs).where(eq(integrationConfigs.integration, INTEGRATION)).limit(1);
  if (stored?.status === "active") {
    try {
      const tenantApiKey = decryptStoredSecret(stored, "tenantApiKey") ?? decryptSecret({ ciphertext: stored.apiKeyCiphertext, iv: stored.apiKeyIv, authTag: stored.apiKeyAuthTag }, encryptionKey());
      if (!tenantApiKey) throw new Error("TENANT_API_KEY_MISSING");
      return { baseUrl: normalizeIntellyDteBaseUrl(stored.baseUrl), tenantApiKey, systemApiKey: decryptStoredSecret(stored, "systemApiKey"), tenantRut: stored.tenantRut ? normalizeIntellyDteTenantRut(stored.tenantRut) : null, apiKey: tenantApiKey };
    } catch {
      throw new AppError("CREDENTIAL_DECRYPTION_FAILED", "No pudimos leer la credencial guardada. Revisa la clave de cifrado.");
    }
  }
  const env = getEnv();
  const tenantApiKey = env.INTELLYDTE_TENANT_API_KEY || env.INTELLYDTE_API_KEY;
  return env.INTELLYDTE_BASE_URL && tenantApiKey ? { baseUrl: normalizeIntellyDteBaseUrl(env.INTELLYDTE_BASE_URL), tenantApiKey, systemApiKey: env.INTELLYDTE_SYSTEM_API_KEY || null, tenantRut: env.INTELLYDTE_TENANT_RUT || env.INTELLYDTE_COMPANY_TAX_ID ? normalizeIntellyDteTenantRut(env.INTELLYDTE_TENANT_RUT || env.INTELLYDTE_COMPANY_TAX_ID!) : null, apiKey: tenantApiKey } : null;
}

export async function getIntellyDteWebhookSecret(): Promise<string | null> {
  const [stored] = await getDb().select().from(integrationConfigs).where(eq(integrationConfigs.integration, INTEGRATION)).limit(1);
  if (stored?.status === "active" && stored.webhookSecretCiphertext && stored.webhookSecretIv && stored.webhookSecretAuthTag) {
    try {
      return decryptSecret({ ciphertext: stored.webhookSecretCiphertext, iv: stored.webhookSecretIv, authTag: stored.webhookSecretAuthTag }, encryptionKey());
    } catch {
      throw new AppError("CREDENTIAL_DECRYPTION_FAILED", "No pudimos leer el secreto de webhook guardado. Revisa la clave de cifrado.");
    }
  }
  return getEnv().INTELLYDTE_WEBHOOK_SECRET || null;
}

export async function getIntellyDtePublicConfig() {
  const [stored] = await getDb().select({ baseUrl: integrationConfigs.baseUrl, apiKeyLastFour: integrationConfigs.apiKeyLastFour, updatedAt: integrationConfigs.updatedAt, status: integrationConfigs.status }).from(integrationConfigs).where(eq(integrationConfigs.integration, INTEGRATION)).limit(1);
  if (stored) return { baseUrl: normalizeIntellyDteBaseUrl(stored.baseUrl), configured: stored.status === "active", apiKeyMask: `••••${stored.apiKeyLastFour}`, updatedAt: stored.updatedAt };
  const env = getEnv();
  const tenantApiKey = env.INTELLYDTE_TENANT_API_KEY || env.INTELLYDTE_API_KEY;
  return { baseUrl: env.INTELLYDTE_BASE_URL ? normalizeIntellyDteBaseUrl(env.INTELLYDTE_BASE_URL) : "", configured: Boolean(env.INTELLYDTE_BASE_URL && tenantApiKey), apiKeyMask: tenantApiKey ? maskApiKey(tenantApiKey) : "", updatedAt: null };
}

export async function saveIntellyDteConfig(input: { baseUrl: string; apiKey?: string; tenantApiKey?: string; systemApiKey?: string; tenantRut?: string; webhookSecret?: string; userId: string }): Promise<void> {
  const baseUrl = validateIntellyDteBaseUrl(input.baseUrl);
  const [existing] = await getDb().select().from(integrationConfigs).where(eq(integrationConfigs.integration, INTEGRATION)).limit(1);
  let encrypted: { ciphertext: string; iv: string; authTag: string; lastFour: string };
  const tenantInput = input.tenantApiKey?.trim() || input.apiKey?.trim();
  if (tenantInput) {
    const apiKey = tenantInput;
    const result = encryptSecret(apiKey, encryptionKey());
    encrypted = { ...result, lastFour: apiKey.slice(-4) };
  } else if (existing) {
    encrypted = { ciphertext: existing.apiKeyCiphertext, iv: existing.apiKeyIv, authTag: existing.apiKeyAuthTag, lastFour: existing.apiKeyLastFour };
  } else {
    throw new AppError("API_KEY_REQUIRED", "Ingresa la API Key de IntellyDTE.");
  }
  let webhookSecret: { ciphertext: string; iv: string; authTag: string; lastFour: string } | null = null;
  if (input.webhookSecret?.trim()) {
    const secret = input.webhookSecret.trim();
    const result = encryptSecret(secret, encryptionKey());
    webhookSecret = { ...result, lastFour: secret.slice(-4) };
  } else if (existing?.webhookSecretCiphertext && existing.webhookSecretIv && existing.webhookSecretAuthTag) {
    webhookSecret = { ciphertext: existing.webhookSecretCiphertext, iv: existing.webhookSecretIv, authTag: existing.webhookSecretAuthTag, lastFour: existing.webhookSecretLastFour ?? "" };
  }
  let systemApiKey: { ciphertext: string; iv: string; authTag: string; lastFour: string } | null = null;
  if (input.systemApiKey?.trim()) {
    const secret = input.systemApiKey.trim();
    const result = encryptSecret(secret, encryptionKey());
    systemApiKey = { ...result, lastFour: secret.slice(-4) };
  } else if (existing?.systemApiKeyCiphertext && existing.systemApiKeyIv && existing.systemApiKeyAuthTag) {
    systemApiKey = { ciphertext: existing.systemApiKeyCiphertext, iv: existing.systemApiKeyIv, authTag: existing.systemApiKeyAuthTag, lastFour: existing.systemApiKeyLastFour ?? "" };
  }
  const tenantRut = input.tenantRut?.trim() ? normalizeIntellyDteTenantRut(input.tenantRut) : existing?.tenantRut || null;
  const set = { baseUrl, apiKeyCiphertext: encrypted.ciphertext, apiKeyIv: encrypted.iv, apiKeyAuthTag: encrypted.authTag, apiKeyLastFour: encrypted.lastFour, tenantApiKeyCiphertext: encrypted.ciphertext, tenantApiKeyIv: encrypted.iv, tenantApiKeyAuthTag: encrypted.authTag, tenantApiKeyLastFour: encrypted.lastFour, systemApiKeyCiphertext: systemApiKey?.ciphertext ?? null, systemApiKeyIv: systemApiKey?.iv ?? null, systemApiKeyAuthTag: systemApiKey?.authTag ?? null, systemApiKeyLastFour: systemApiKey?.lastFour ?? null, tenantRut, webhookSecretCiphertext: webhookSecret?.ciphertext ?? null, webhookSecretIv: webhookSecret?.iv ?? null, webhookSecretAuthTag: webhookSecret?.authTag ?? null, webhookSecretLastFour: webhookSecret?.lastFour ?? null, status: "active" as const, updatedBy: input.userId, updatedAt: new Date() };
  await getDb().insert(integrationConfigs).values({ id: existing?.id ?? randomUUID(), integration: INTEGRATION, ...set }).onDuplicateKeyUpdate({ set });
}
