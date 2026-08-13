import { createHash, randomUUID } from "node:crypto";
import { and, count, eq, gt } from "drizzle-orm";
import { getDb } from "@/db";
import { loginAttempts, users } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { hashPassword, verifyPassword } from "@/features/auth/password";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const dummyHash = hashPassword("dummy-password-never-valid");

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function authenticate(emailInput: string, password: string, ip: string) {
  const email = emailInput.trim().toLowerCase();
  const emailHash = digest(email);
  const ipHash = digest(ip || "unknown");
  const since = new Date(Date.now() - WINDOW_MS);
  const [{ value: recent }] = await getDb().select({ value: count() }).from(loginAttempts)
    .where(and(eq(loginAttempts.succeeded, false), gt(loginAttempts.occurredAt, since), eq(loginAttempts.emailHash, emailHash)));

  if (recent >= MAX_ATTEMPTS) throw new AppError("LOGIN_THROTTLED", "No pudimos iniciar sesión. Intenta más tarde.", 429);

  const [user] = await getDb().select().from(users).where(eq(users.email, email)).limit(1);
  const valid = await verifyPassword(user?.passwordHash ?? await dummyHash, password);
  const usable = user && user.status === "active" && (!user.lockedUntil || user.lockedUntil <= new Date());
  const success = Boolean(valid && usable);

  await getDb().insert(loginAttempts).values({ id: randomUUID(), emailHash, ipHash, succeeded: success });
  if (!success || !user) {
    if (user) {
      const failures = user.failedLoginCount + 1;
      await getDb().update(users).set({
        failedLoginCount: failures,
        lockedUntil: failures >= MAX_ATTEMPTS ? new Date(Date.now() + WINDOW_MS) : null,
      }).where(eq(users.id, user.id));
    }
    throw new AppError("INVALID_CREDENTIALS", "Correo o contraseña incorrectos.", 401);
  }

  await getDb().update(users).set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(users.id, user.id));
  return user;
}
