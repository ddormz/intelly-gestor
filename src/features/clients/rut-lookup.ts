import "server-only";

import { AppError } from "@/lib/errors";
import { lookupIntellyDteRut, type RutLookupResult } from "@/features/integrations/intellydte";
import { validChileanRut } from "./validation";

function normalizeRut(value: string): string {
  const compact = value.replace(/[^0-9kK]/g, "").toUpperCase();
  return `${compact.slice(0, -1)}-${compact.at(-1) ?? ""}`;
}

export async function lookupClientRut(rut: string): Promise<RutLookupResult> {
  if (!validChileanRut(rut)) throw new AppError("INVALID_RUT", "Ingresa un RUT chileno válido.", 400);
  return lookupIntellyDteRut(normalizeRut(rut));
}
