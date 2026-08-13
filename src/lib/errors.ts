import { randomUUID } from "node:crypto";

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
    public readonly correlationId = randomUUID(),
  ) {
    super(message);
  }
}

export function safeError(error: unknown) {
  if (error instanceof AppError) {
    return { code: error.code, message: error.message, correlationId: error.correlationId };
  }
  return {
    code: "UNEXPECTED_ERROR",
    message: "No pudimos completar la operación. Intenta nuevamente.",
    correlationId: randomUUID(),
  };
}

const secretKeys = /password|secret|token|authorization|api[-_]?key|database_url/i;

export function redactMetadata(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, secretKeys.test(key) ? "[REDACTED]" : item]),
  );
}
