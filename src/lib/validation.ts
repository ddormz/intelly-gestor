import type { ZodType } from "zod";
import { AppError } from "@/lib/errors";

export function parseInput<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppError("VALIDATION_ERROR", result.error.issues[0]?.message ?? "Datos inválidos.");
  }
  return result.data;
}

export function formObject(data: FormData): Record<string, string> {
  return Object.fromEntries([...data.entries()].map(([key, value]) => [key, String(value)]));
}
