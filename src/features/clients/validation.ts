import { z } from "zod";

function normalizeRut(value: string): string { return value.replace(/[^0-9kK]/g, "").toUpperCase(); }

export function validChileanRut(value: string): boolean {
  const rut = normalizeRut(value);
  if (rut.length < 2) return false;
  const body = rut.slice(0, -1);
  const verifier = rut.at(-1);
  let sum = 0, multiplier = 2;
  for (let index = body.length - 1; index >= 0; index--) {
    sum += Number(body[index]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const expectedValue = 11 - (sum % 11);
  const expected = expectedValue === 11 ? "0" : expectedValue === 10 ? "K" : String(expectedValue);
  return verifier === expected;
}

export const clientSchema = z.object({
  kind: z.enum(["person", "company"]),
  taxId: z.string().trim().refine(validChileanRut, "Ingresa un RUT chileno válido."),
  legalName: z.string().trim().min(2, "Ingresa la razón social o nombre.").max(180),
  email: z.string().trim().email("Ingresa un correo válido.").max(254),
  phone: z.string().trim().max(30).optional(),
  addressLine: z.string().trim().max(240).optional(),
  commune: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
});
