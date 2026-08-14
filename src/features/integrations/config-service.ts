import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "@/db";
import { integrationConfigs } from "@/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/encryption";
import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";

const INTEGRATION = "intellydte";

function encryptionKey(): Buffer {
  const encoded = getEnv().CREDENTIALS_ENCRYPTION_KEY;
  if (!encoded) throw new AppError("ENCRYPTION_NOT_CONFIGURED", "Configura CREDENTIALS_ENCRYPTION_KEY antes de guardar credenciales.");
  return Buffer.from(encoded, "base64");
}

export function maskApiKey(value: string): string {
  return `••••${value.slice(-4)}`;
}

export function validateIntellyDteBaseUrl(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new AppError("INVALID_BASE_URL", "Ingresa una Base URL válida."); }
  const allowedHost = url.hostname === "intelly.cl" || url.hostname.endsWith(".intelly.cl") || url.hostname === "intellydte.cl" || url.hostname.endsWith(".intellydte.cl");
  if (url.protocol !== "https:" || !allowedHost) {
    throw new AppError("INVALID_BASE_URL", "La Base URL debe usar HTTPS y pertenecer a Intelly.");
  }
  return url.toString().replace(/\/$/, "");
}

export async function getIntellyDteConfig(): Promise<{ baseUrl: string; apiKey: string } | null> {
  const [stored] = await getDb().select().from(integrationConfigs).where(eq(integrationConfigs.integration, INTEGRATION)).limit(1);
  if (stored?.status === "active") {
    try {
      return { baseUrl: stored.baseUrl, apiKey: decryptSecret({ ciphertext: stored.apiKeyCiphertext, iv: stored.apiKeyIv, authTag: stored.apiKeyAuthTag }, encryptionKey()) };
    } catch {
      throw new AppError("CREDENTIAL_DECRYPTION_FAILED", "No pudimos leer la credencial guardada. Revisa la clave de cifrado.");
    }
  }
  const env = getEnv();
  return env.INTELLYDTE_BASE_URL && env.INTELLYDTE_API_KEY ? { baseUrl: env.INTELLYDTE_BASE_URL, apiKey: env.INTELLYDTE_API_KEY } : null;
}

export async function getIntellyDtePublicConfig() {
  const [stored] = await getDb().select({ baseUrl: integrationConfigs.baseUrl, apiKeyLastFour: integrationConfigs.apiKeyLastFour, updatedAt: integrationConfigs.updatedAt, status: integrationConfigs.status }).from(integrationConfigs).where(eq(integrationConfigs.integration, INTEGRATION)).limit(1);
  if (stored) return { baseUrl: stored.baseUrl, configured: stored.status === "active", apiKeyMask: `••••${stored.apiKeyLastFour}`, updatedAt: stored.updatedAt };
  const env = getEnv();
  return { baseUrl: env.INTELLYDTE_BASE_URL ?? "", configured: Boolean(env.INTELLYDTE_BASE_URL && env.INTELLYDTE_API_KEY), apiKeyMask: env.INTELLYDTE_API_KEY ? maskApiKey(env.INTELLYDTE_API_KEY) : "", updatedAt: null };
}

export async function saveIntellyDteConfig(input: { baseUrl: string; apiKey?: string; userId: string }): Promise<void> {
  const baseUrl = validateIntellyDteBaseUrl(input.baseUrl);
  const [existing] = await getDb().select().from(integrationConfigs).where(eq(integrationConfigs.integration, INTEGRATION)).limit(1);
  let encrypted: { ciphertext: string; iv: string; authTag: string; lastFour: string };
  if (input.apiKey?.trim()) {
    const apiKey = input.apiKey.trim();
    const result = encryptSecret(apiKey, encryptionKey());
    encrypted = { ...result, lastFour: apiKey.slice(-4) };
  } else if (existing) {
    encrypted = { ciphertext: existing.apiKeyCiphertext, iv: existing.apiKeyIv, authTag: existing.apiKeyAuthTag, lastFour: existing.apiKeyLastFour };
  } else {
    throw new AppError("API_KEY_REQUIRED", "Ingresa la API Key de IntellyDTE.");
  }
  await getDb().insert(integrationConfigs).values({ id: existing?.id ?? randomUUID(), integration: INTEGRATION, baseUrl, apiKeyCiphertext: encrypted.ciphertext, apiKeyIv: encrypted.iv, apiKeyAuthTag: encrypted.authTag, apiKeyLastFour: encrypted.lastFour, status: "active", updatedBy: input.userId, updatedAt: new Date() }).onDuplicateKeyUpdate({ set: { baseUrl, apiKeyCiphertext: encrypted.ciphertext, apiKeyIv: encrypted.iv, apiKeyAuthTag: encrypted.authTag, apiKeyLastFour: encrypted.lastFour, status: "active", updatedBy: input.userId, updatedAt: new Date() } });
}
