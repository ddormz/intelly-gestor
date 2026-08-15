import { AppError } from "@/lib/errors";

export type OrderActorRole = "admin" | "operator";
export const MAX_UNIT_PRICE = Number.MAX_SAFE_INTEGER;
export const OPERATOR_PRICE_VARIANCE = 0.2;

function parseIntegerClp(value: string | number): number {
  const normalized = String(value).trim();
  if (normalized.startsWith("-")) throw new AppError("INVALID_UNIT_PRICE", "El precio debe estar entre 0 y el máximo permitido.");
  if (!/^\d+(?:\.0{1,2})?$/.test(normalized)) throw new AppError("INVALID_UNIT_PRICE", "El precio debe ser un monto CLP entero.");
  const number = Number(normalized);
  if (!Number.isSafeInteger(number) || number < 0 || number > MAX_UNIT_PRICE) throw new AppError("INVALID_UNIT_PRICE", "El precio debe estar entre 0 y el máximo permitido.");
  return number;
}

export function validateUnitPriceOverride(value: string | number, catalogPrice: string | number, role: OrderActorRole): number {
  const price = parseIntegerClp(value);
  const basePrice = parseIntegerClp(catalogPrice);
  if (role === "operator") {
    const variance = Math.max(100, Math.ceil(basePrice * OPERATOR_PRICE_VARIANCE));
    const minimum = Math.max(0, basePrice - variance);
    const maximum = Math.min(MAX_UNIT_PRICE, basePrice + variance);
    if (price < minimum || price > maximum) throw new AppError("PRICE_OVERRIDE_OUT_OF_RANGE", "El precio está fuera del rango autorizado para tu rol.", 403);
  }
  return price;
}
