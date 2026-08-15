import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/encryption";
import { maskApiKey, validateIntellyDteBaseUrl } from "@/features/integrations/config-service";
import { parseAppEnv, publicConfig } from "@/lib/env";

const key = Buffer.alloc(32, 9);

describe("encrypted integration configuration", () => {
  it("round-trips AES-GCM secrets with unique IVs", () => {
    const first = encryptSecret("api-secret-1234", key);
    const second = encryptSecret("api-secret-1234", key);
    expect(first.iv).not.toBe(second.iv);
    expect(decryptSecret(first, key)).toBe("api-secret-1234");
  });

  it("rejects tampered ciphertext", () => {
    const encrypted = encryptSecret("api-secret-1234", key);
    expect(() => decryptSecret({ ...encrypted, ciphertext: `${encrypted.ciphertext.slice(0, -2)}AA` }, key)).toThrow();
  });

  it("masks API keys and accepts only HTTPS Intelly hosts", () => {
    expect(maskApiKey("api-secret-1234")).toBe("••••1234");
    expect(validateIntellyDteBaseUrl("https://api.intelly.cl")).toBe("https://api.intelly.cl");
    expect(validateIntellyDteBaseUrl("https://api.intelly.cl/api")).toBe("https://api.intelly.cl");
    expect(validateIntellyDteBaseUrl("https://api.intelly.cl/api/v1")).toBe("https://api.intelly.cl");
    expect(validateIntellyDteBaseUrl("https://api.intellydte.cl/v1")).toBe("https://api.intellydte.cl");
    expect(() => validateIntellyDteBaseUrl("http://localhost:3000")).toThrow();
    expect(() => validateIntellyDteBaseUrl("https://example.com")).toThrow();
  });

  it("keeps the RUT lookup credential server-only in public configuration", () => {
    const env = parseAppEnv({ DATABASE_URL: "mysql://user:pass@localhost:3306/app", INTELLYDTE_MODE: "http", INTELLYDTE_API_KEY: "secret" });
    expect(env.INTELLYDTE_API_KEY).toBe("secret");
    process.env.DATABASE_URL = "mysql://user:pass@localhost:3306/app";
    expect(publicConfig()).not.toHaveProperty("apiKey");
  });
});
