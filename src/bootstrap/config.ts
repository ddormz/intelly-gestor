import { z } from "zod";

export type BootstrapAdminConfig =
  | { enabled: false }
  | { enabled: true; email: string; name: string; password: string };

const enabledSchema = z.object({
  ADMIN_EMAIL: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  ADMIN_NAME: z.string().trim().min(1).max(120).default("Administrador"),
  ADMIN_PASSWORD: z.string().min(12).max(128),
});

export function parseBootstrapAdminConfig(env: Record<string, string | undefined>): BootstrapAdminConfig {
  if (env.BOOTSTRAP_ADMIN_ENABLED !== "true") return { enabled: false };
  const parsed = enabledSchema.parse(env);
  return {
    enabled: true,
    email: parsed.ADMIN_EMAIL,
    name: parsed.ADMIN_NAME,
    password: parsed.ADMIN_PASSWORD,
  };
}
