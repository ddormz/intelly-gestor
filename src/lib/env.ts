import { z } from "zod";

const encryptionKeySchema = z.string().refine((value) => {
  try {
    return Buffer.from(value, "base64").length === 32;
  } catch {
    return false;
  }
}, "CREDENTIALS_ENCRYPTION_KEY debe contener exactamente 32 bytes codificados en base64.");

const envSchema = z.object({
  DATABASE_URL: z.string().url().startsWith("mysql://"),
  DB_POOL_LIMIT: z.coerce.number().int().min(1).max(10).default(5),
  SESSION_COOKIE_NAME: z.string().regex(/^[a-zA-Z0-9_-]+$/).default("intelly_session"),
  APP_ORIGIN: z.string().url().default("http://localhost:3000"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  CREDENTIALS_ENCRYPTION_KEY: encryptionKeySchema.optional(),
  SMTP_HOST: z.string().trim().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(465),
  SMTP_USER: z.string().trim().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  SMTP_FROM: z.string().trim().min(1).optional(),
  INTELLYDTE_MODE: z.enum(["fake", "http"]).default("fake"),
  INTELLYDTE_BASE_URL: z.string().url().optional().or(z.literal("")),
  INTELLYDTE_API_KEY: z.string().trim().optional(),
  INTELLYDTE_TENANT_API_KEY: z.string().trim().optional(),
  INTELLYDTE_SYSTEM_API_KEY: z.string().trim().optional(),
  INTELLYDTE_TENANT_RUT: z.string().trim().optional(),
  INTELLYDTE_COMPANY_TAX_ID: z.string().optional(),
  INTELLYDTE_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(10000),
  INTELLYDTE_EMISSION_MODE: z.enum(["sync", "async", "fast-ack"]).default("async"),
  INTELLYDTE_WEBHOOK_SECRET: z.string().trim().optional(),
  FISCAL_EVIDENCE_DIR: z.string().trim().min(1).default("data/fiscal-evidence"),
  WEBPAY_COMMERCE_CODE: z.string().trim().optional(),
  WEBPAY_API_KEY: z.string().trim().optional(),
  WEBPAY_ENVIRONMENT: z.enum(["integration", "production"]).default("integration"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | undefined;

export function getEnv(): AppEnv {
  cached ??= parseAppEnv(process.env);
  return cached;
}

export function parseAppEnv(input: Record<string, string | undefined>): AppEnv {
  return envSchema.parse(input);
}

export function publicConfig() {
  const env = getEnv();
  return { intellyDteMode: env.INTELLYDTE_MODE } as const;
}
