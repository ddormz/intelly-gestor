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

const secretKeys = /password|secret|token|authorization|api[-_]?key|database_url|signed[-_]?xml|print[-_]?payload|^ted|^pdf|^xml$|base64/i;

function redactValue(value: unknown, key = ""): unknown {
  if (secretKeys.test(key)) return "[REDACTED]";
  if (Array.isArray(value)) return value.map((item) => redactValue(item));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, redactValue(childValue, childKey)]));
  return value;
}

export function redactMetadata(value: Record<string, unknown>): Record<string, unknown> {
  return redactValue(value) as Record<string, unknown>;
}
