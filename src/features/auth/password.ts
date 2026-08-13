import { hash, verify } from "@node-rs/argon2";

const options = {
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
};

export function hashPassword(password: string): Promise<string> {
  if (password.length < 12 || password.length > 128) {
    throw new RangeError("La contraseña debe tener entre 12 y 128 caracteres.");
  }
  return hash(password, options);
}

export function verifyPassword(storedHash: string, password: string): Promise<boolean> {
  return verify(storedHash, password, options).catch(() => false);
}
