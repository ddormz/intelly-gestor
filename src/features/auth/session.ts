import { randomUUID } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { sessions, users } from "@/db/schema";
import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { hashToken, randomToken } from "@/lib/security";

const IDLE_MS = 30 * 60 * 1000;
const ABSOLUTE_MS = 12 * 60 * 60 * 1000;

function hashContext(value: string | null): string | undefined {
  return value ? hashToken(value) : undefined;
}

export async function createSession(userId: string): Promise<void> {
  const env = getEnv();
  const requestHeaders = await headers();
  const token = randomToken();
  const now = new Date();
  await getDb().insert(sessions).values({
    id: randomUUID(),
    userId,
    tokenHash: hashToken(token),
    ipHash: hashContext(requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null),
    userAgent: requestHeaders.get("user-agent")?.slice(0, 300),
    lastSeenAt: now,
    idleExpiresAt: new Date(now.getTime() + IDLE_MS),
    absoluteExpiresAt: new Date(now.getTime() + ABSOLUTE_MS),
  });
  const jar = await cookies();
  jar.set(env.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ABSOLUTE_MS / 1000,
  });
}

export async function getCurrentSession() {
  const env = getEnv();
  const token = (await cookies()).get(env.SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const now = new Date();
  const [row] = await getDb()
    .select({
      sessionId: sessions.id,
      userId: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      idleExpiresAt: sessions.idleExpiresAt,
      absoluteExpiresAt: sessions.absoluteExpiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(
      eq(sessions.tokenHash, hashToken(token)),
      isNull(sessions.revokedAt),
      gt(sessions.idleExpiresAt, now),
      gt(sessions.absoluteExpiresAt, now),
      eq(users.status, "active"),
    ))
    .limit(1);
  return row ?? null;
}

export async function requireUser(requiredRole?: "admin" | "operator") {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (requiredRole === "admin" && session.role !== "admin") {
    throw new AppError("FORBIDDEN", "No tienes permisos para realizar esta acción.", 403);
  }
  return session;
}

export async function revokeCurrentSession(): Promise<void> {
  const env = getEnv();
  const jar = await cookies();
  const token = jar.get(env.SESSION_COOKIE_NAME)?.value;
  if (token) {
    await getDb().update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.tokenHash, hashToken(token)));
  }
  jar.delete(env.SESSION_COOKIE_NAME);
}
