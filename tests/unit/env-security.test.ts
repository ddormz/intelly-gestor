import { describe, expect, it } from "vitest";
import { integrationConfigs, passwordResetRequests, passwordResetTokens } from "@/db/schema";
import { parseAppEnv } from "@/lib/env";

const completeEnv = {
  DATABASE_URL: "mysql://user:password@localhost:3306/intelly",
  APP_URL: "https://gestion.intelly.cl",
  CREDENTIALS_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  SMTP_HOST: "smtp.hostinger.com",
  SMTP_PORT: "465",
  SMTP_USER: "no-reply@intelly.cl",
  SMTP_PASSWORD: "example-only-password",
  SMTP_FROM: "Intelly Gestor <no-reply@intelly.cl>",
};

describe("secure environment and schema", () => {
  it("accepts a complete SMTP configuration and a 32-byte encryption key", () => {
    const parsed = parseAppEnv(completeEnv);

    expect(parsed.SMTP_PORT).toBe(465);
    expect(parsed.CREDENTIALS_ENCRYPTION_KEY).toBe(completeEnv.CREDENTIALS_ENCRYPTION_KEY);
  });

  it("rejects encryption keys that are not exactly 32 bytes", () => {
    expect(() => parseAppEnv({ ...completeEnv, CREDENTIALS_ENCRYPTION_KEY: Buffer.alloc(16).toString("base64") })).toThrow();
  });

  it("exposes encrypted integration and password recovery columns", () => {
    expect(integrationConfigs.apiKeyCiphertext).toBeDefined();
    expect(integrationConfigs.apiKeyAuthTag).toBeDefined();
    expect(passwordResetTokens.tokenHash).toBeDefined();
    expect(passwordResetRequests.ipHash).toBeDefined();
  });
});
