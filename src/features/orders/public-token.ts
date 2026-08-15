import { decryptSecret, encryptSecret } from "@/lib/encryption";
import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";

function encryptionKey(): Buffer {
  const encoded = getEnv().CREDENTIALS_ENCRYPTION_KEY;
  if (!encoded) throw new AppError("PUBLIC_TOKEN_ENCRYPTION_NOT_CONFIGURED", "La configuración segura de enlaces públicos no está disponible.", 503);
  return Buffer.from(encoded, "base64");
}

export function encryptPublicToken(token: string) {
  return encryptSecret(token, encryptionKey());
}

export function decryptPublicToken(secret: { ciphertext: string; iv: string; authTag: string }): string {
  return decryptSecret(secret, encryptionKey());
}
