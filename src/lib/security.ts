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
  const expected = new URL(getEnv().APP_ORIGIN).origin;
  if (!origin || origin !== expected) throw new AppError("INVALID_ORIGIN", "Solicitud rechazada.", 403);
}
