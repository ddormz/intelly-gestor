import { randomUUID } from "node:crypto";
import { and, count, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { passwordResetRequests, passwordResetTokens, sessions, users } from "@/db/schema";
import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { hashToken, randomToken } from "@/lib/security";
import { hashPassword } from "./password";
import { sendPasswordResetEmail } from "@/features/email/mailer";

const EXPIRY_MINUTES = 30;

export type PasswordResetToken = { token: string; tokenHash: string; expiresAt: Date };
type ResetUser = { id: string; email: string; name: string };
type UsableToken = { tokenId: string; userId: string };

export interface PasswordResetRepository {
  recordRequest(emailHash: string, ipHash: string, now: Date): Promise<boolean>;
  findActiveUser(email: string): Promise<ResetUser | null>;
  replaceToken(userId: string, token: Omit<PasswordResetToken, "token"> & { requestedIpHash: string }, now: Date): Promise<void>;
  findUsableToken(tokenHash: string, now: Date): Promise<UsableToken | null>;
  completeReset(input: { tokenId: string; userId: string; passwordHash: string; now: Date }): Promise<void>;
}

export type PasswordResetDependencies = {
  appUrl: string;
  now: () => Date;
  repository: PasswordResetRepository;
  sendResetEmail: typeof sendPasswordResetEmail;
  hashPassword: typeof hashPassword;
};

export function createPasswordResetToken(now: Date, token = randomToken()): PasswordResetToken {
  return { token, tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + EXPIRY_MINUTES * 60_000) };
}

const databaseRepository: PasswordResetRepository = {
  async recordRequest(emailHash, ipHash, now) {
    await getDb().insert(passwordResetRequests).values({ id: randomUUID(), emailHash, ipHash, createdAt: now });
    const since = new Date(now.getTime() - 15 * 60_000);
    const [[emailCount], [ipCount]] = await Promise.all([
      getDb().select({ value: count() }).from(passwordResetRequests).where(and(eq(passwordResetRequests.emailHash, emailHash), gt(passwordResetRequests.createdAt, since))),
      getDb().select({ value: count() }).from(passwordResetRequests).where(and(eq(passwordResetRequests.ipHash, ipHash), gt(passwordResetRequests.createdAt, since))),
    ]);
    return Number(emailCount?.value ?? 0) <= 3 && Number(ipCount?.value ?? 0) <= 10;
  },
  async findActiveUser(email) {
    const [user] = await getDb().select({ id: users.id, email: users.email, name: users.name }).from(users).where(and(eq(users.email, email), eq(users.status, "active"))).limit(1);
    return user ?? null;
  },
  async replaceToken(userId, token, now) {
    await getDb().transaction(async (tx) => {
      await tx.update(passwordResetTokens).set({ usedAt: now }).where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt)));
      await tx.insert(passwordResetTokens).values({ id: randomUUID(), userId, tokenHash: token.tokenHash, expiresAt: token.expiresAt, requestedIpHash: token.requestedIpHash, createdAt: now });
    });
  },
  async findUsableToken(tokenHash, now) {
    const [token] = await getDb().select({ tokenId: passwordResetTokens.id, userId: passwordResetTokens.userId }).from(passwordResetTokens).innerJoin(users, eq(users.id, passwordResetTokens.userId)).where(and(eq(passwordResetTokens.tokenHash, tokenHash), gt(passwordResetTokens.expiresAt, now), isNull(passwordResetTokens.usedAt), eq(users.status, "active"))).limit(1);
    return token ?? null;
  },
  async completeReset(input) {
    await getDb().transaction(async (tx) => {
      const [result] = await tx.update(passwordResetTokens).set({ usedAt: input.now }).where(and(eq(passwordResetTokens.id, input.tokenId), isNull(passwordResetTokens.usedAt)));
      if (result.affectedRows !== 1) throw new AppError("RESET_TOKEN_USED", "El enlace de recuperación es inválido o venció.");
      await tx.update(users).set({ passwordHash: input.passwordHash, passwordChangedAt: input.now, failedLoginCount: 0, lockedUntil: null, updatedAt: input.now }).where(eq(users.id, input.userId));
      await tx.update(sessions).set({ revokedAt: input.now }).where(eq(sessions.userId, input.userId));
      await tx.update(passwordResetTokens).set({ usedAt: input.now }).where(and(eq(passwordResetTokens.userId, input.userId), isNull(passwordResetTokens.usedAt)));
    });
  },
};

function defaultDependencies(): PasswordResetDependencies {
  return { appUrl: getEnv().APP_URL, now: () => new Date(), repository: databaseRepository, sendResetEmail: sendPasswordResetEmail, hashPassword };
}

export async function requestPasswordReset(emailInput: string, ip: string, dependencies: PasswordResetDependencies = defaultDependencies()): Promise<void> {
  const email = emailInput.trim().toLowerCase();
  const now = dependencies.now();
  const emailHash = hashToken(email);
  const ipHash = hashToken(ip || "unknown");
  if (!(await dependencies.repository.recordRequest(emailHash, ipHash, now))) return;
  const user = await dependencies.repository.findActiveUser(email);
  if (!user) return;
  const token = createPasswordResetToken(now);
  await dependencies.repository.replaceToken(user.id, { tokenHash: token.tokenHash, expiresAt: token.expiresAt, requestedIpHash: ipHash }, now);
  const resetUrl = new URL("/restablecer-contrasena", dependencies.appUrl);
  resetUrl.searchParams.set("token", token.token);
  try {
    await dependencies.sendResetEmail({ to: user.email, name: user.name, resetUrl: resetUrl.toString(), expiresMinutes: EXPIRY_MINUTES });
  } catch {
    // The public response remains neutral and does not expose account or SMTP state.
  }
}

export async function consumePasswordReset(token: string, password: string, dependencies: PasswordResetDependencies = defaultDependencies()): Promise<string> {
  const now = dependencies.now();
  const usable = await dependencies.repository.findUsableToken(hashToken(token), now);
  if (!usable) throw new AppError("RESET_TOKEN_INVALID", "El enlace de recuperación es inválido o venció.");
  const passwordHash = await dependencies.hashPassword(password);
  await dependencies.repository.completeReset({ ...usable, passwordHash, now });
  return usable.userId;
}
