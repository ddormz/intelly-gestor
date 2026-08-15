import { describe, expect, it } from "vitest";
import { consumePasswordReset, createPasswordResetToken, requestPasswordReset, type PasswordResetDependencies } from "@/features/auth/password-reset";
import { normalizeRequestIp } from "@/features/auth/request-ip";

const now = new Date("2026-08-14T12:00:00.000Z");

function dependencies(user: { id: string; email: string; name: string } | null): { deps: PasswordResetDependencies; sent: string[]; completed: string[] } {
  const sent: string[] = [];
  const completed: string[] = [];
  let stored: { tokenHash: string; expiresAt: Date; userId: string } | null = null;
  return {
    sent,
    completed,
    deps: {
      appUrl: "https://gestion.intelly.cl",
      now: () => now,
      repository: {
        async recordRequest() { return true; },
        async findActiveUser() { return user; },
        async replaceToken(userId, token) { stored = { userId, tokenHash: token.tokenHash, expiresAt: token.expiresAt }; },
        async findUsableToken(tokenHash) { return stored?.tokenHash === tokenHash && stored.expiresAt > now ? { tokenId: "token-1", userId: stored.userId } : null; },
        async completeReset(input) {
          if (!stored || input.tokenHash !== stored.tokenHash || input.now >= stored.expiresAt) throw new Error("expired");
          completed.push(`${input.tokenId}:${input.userId}:${input.passwordHash}`);
        },
      },
      async sendResetEmail(input) { sent.push(input.to); },
      async hashPassword() { return "argon-hash"; },
    },
  };
}

describe("password recovery", () => {
  it("accepts only valid proxy IP values and prefers the nearest proxy hop", () => {
    expect(normalizeRequestIp("127.0.0.1", "198.51.100.10, 203.0.113.7")).toBe("127.0.0.1");
    expect(normalizeRequestIp(null, "198.51.100.10, 203.0.113.7")).toBe("203.0.113.7");
    expect(normalizeRequestIp("not-an-ip", "spoofed")).toBe("unknown");
  });

  it("creates a random token while storing only its hash for 30 minutes", () => {
    const result = createPasswordResetToken(now, "raw-reset-token");
    expect(result.token).toBe("raw-reset-token");
    expect(result.tokenHash).not.toContain("raw-reset-token");
    expect(result.expiresAt.toISOString()).toBe("2026-08-14T12:30:00.000Z");
  });

  it("returns the same observable result for known and unknown email", async () => {
    const known = dependencies({ id: "user-1", email: "persona@intelly.cl", name: "Persona" });
    const unknown = dependencies(null);
    await expect(requestPasswordReset("persona@intelly.cl", "127.0.0.1", known.deps)).resolves.toBeUndefined();
    await expect(requestPasswordReset("nadie@intelly.cl", "127.0.0.1", unknown.deps)).resolves.toBeUndefined();
    expect(known.sent).toEqual(["persona@intelly.cl"]);
    expect(unknown.sent).toEqual([]);
  });

  it("consumes a token once through the atomic completion boundary", async () => {
    const context = dependencies({ id: "user-1", email: "persona@intelly.cl", name: "Persona" });
    let deliveredToken = "";
    context.deps.sendResetEmail = async (input) => { deliveredToken = new URL(input.resetUrl).searchParams.get("token") ?? ""; };
    await requestPasswordReset("persona@intelly.cl", "127.0.0.1", context.deps);
    await consumePasswordReset(deliveredToken, "UnaClaveNueva123", context.deps);
    expect(context.completed).toEqual(["token-1:user-1:argon-hash"]);
    await expect(consumePasswordReset("token-invalido", "UnaClaveNueva123", context.deps)).rejects.toThrow(/inválido o venció/i);
  });

  it("rechecks expiration after the password hash finishes", async () => {
    const context = dependencies({ id: "user-1", email: "persona@intelly.cl", name: "Persona" });
    let deliveredToken = "";
    let calls = 0;
    context.deps.now = () => calls++ < 2 ? now : new Date("2026-08-14T12:31:00.000Z");
    context.deps.sendResetEmail = async (input) => { deliveredToken = new URL(input.resetUrl).searchParams.get("token") ?? ""; };
    await requestPasswordReset("persona@intelly.cl", "127.0.0.1", context.deps);
    await expect(consumePasswordReset(deliveredToken, "UnaClaveNueva123", context.deps)).rejects.toThrow(/venciÃ³|expired/i);
    expect(context.completed).toEqual([]);
  });
});
