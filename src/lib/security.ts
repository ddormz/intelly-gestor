import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { AppError } from "@/lib/errors";
import { getEnv } from "@/lib/env";

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function enforceSameOrigin(): Promise<void> {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  if (!origin) return;

  try {
    const expected = new URL(getEnv().APP_ORIGIN).origin;
    if (origin === expected) return;
  } catch {
    // configured APP_ORIGIN not a valid URL
  }

  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
  if (host) {
    try {
      const originHost = new URL(origin).host.toLowerCase();
      if (originHost === host.toLowerCase()) return;
    } catch {
      // malformed origin
    }
  }

  throw new AppError("INVALID_ORIGIN", "Solicitud rechazada.", 403);
}
