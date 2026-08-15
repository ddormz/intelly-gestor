const MAX_CODE_LENGTH = 10;

function usableCodeCharacters(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function candidateWithSuffix(base: string, suffix: string): string {
  const prefixLength = Math.max(1, MAX_CODE_LENGTH - suffix.length);
  return `${base.slice(0, prefixLength)}${suffix}`.slice(0, MAX_CODE_LENGTH);
}

export function generateCatalogCode(name: string, existingCodes: string[]): string {
  const normalizedName = usableCodeCharacters(name);
  const base = normalizedName.length >= 2
    ? normalizedName.slice(0, MAX_CODE_LENGTH)
    : `CONCEPTO${normalizedName}`.slice(0, MAX_CODE_LENGTH);
  const occupied = new Set(existingCodes.map((code) => usableCodeCharacters(code)));
  if (!occupied.has(base)) return base;

  for (let suffix = 1; suffix <= 999_999_999; suffix++) {
    const candidate = candidateWithSuffix(base, String(suffix));
    if (!occupied.has(candidate)) return candidate;
  }

  throw new Error("No fue posible generar un código único para el concepto.");
}
