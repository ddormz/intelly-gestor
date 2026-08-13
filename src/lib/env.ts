import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url().startsWith("mysql://"),
  DB_POOL_LIMIT: z.coerce.number().int().min(1).max(10).default(5),
  SESSION_COOKIE_NAME: z.string().regex(/^[a-zA-Z0-9_-]+$/).default("intelly_session"),
  APP_ORIGIN: z.string().url().default("http://localhost:3000"),
  INTELLYDTE_MODE: z.enum(["fake", "http"]).default("fake"),
  INTELLYDTE_BASE_URL: z.string().url().optional().or(z.literal("")),
  INTELLYDTE_API_KEY: z.string().optional(),
  INTELLYDTE_COMPANY_TAX_ID: z.string().optional(),
  INTELLYDTE_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(10000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | undefined;

export function getEnv(): AppEnv {
  cached ??= envSchema.parse(process.env);
  return cached;
}

export function publicConfig() {
  const env = getEnv();
  return { intellyDteMode: env.INTELLYDTE_MODE } as const;
}
