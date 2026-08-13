import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/features/auth/password";
import { hashToken, randomToken } from "@/lib/security";

describe("authentication primitives", () => {
  it("stores passwords with Argon2id and verifies only the correct value", async () => {
    const encoded = await hashPassword("correct horse battery staple");
    expect(encoded).toContain("argon2id");
    await expect(verifyPassword(encoded, "correct horse battery staple")).resolves.toBe(true);
    await expect(verifyPassword(encoded, "wrong password value")).resolves.toBe(false);
  });

  it("creates high-entropy opaque tokens and stores only a digest", () => {
    const token = randomToken();
    expect(token.length).toBeGreaterThanOrEqual(43);
    expect(hashToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashToken(token)).not.toContain(token);
  });
});
