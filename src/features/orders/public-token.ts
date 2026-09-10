import { createHash } from "node:crypto";
import { decryptSecret, encryptSecret } from "@/lib/encryption";
import { getEnv } from "@/lib/env";

function encryptionKey(): Buffer {
  const encoded = getEnv().CREDENTIALS_ENCRYPTION_KEY;
  if (encoded) {
    try {
      const buf = Buffer.from(encoded, "base64");
      if (buf.length === 32) return buf;
    } catch {
      // fallback to derived key
    }
  }
  const secret = process.env.APP_SECRET || process.env.SESSION_SECRET || "intelly-public-token-default-key-salt";
  return createHash("sha256").update(secret).digest();
}

export function encryptPublicToken(token: string) {
  return encryptSecret(token, encryptionKey());
}

export function decryptPublicToken(secret: { ciphertext: string; iv: string; authTag: string }): string {
  return decryptSecret(secret, encryptionKey());
}
