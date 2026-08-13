const CLP_DECIMALS = 0;

export type Money = Readonly<{ minor: bigint; currency: "CLP" }>;

export function clp(minor: bigint | number): Money {
  const value = BigInt(minor);
  if (value < 0n) throw new RangeError("El monto no puede ser negativo.");
  return { minor: value, currency: "CLP" };
}

export function multiplyMoney(unit: Money, quantity: number): Money {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new RangeError("La cantidad debe ser un entero positivo.");
  }
  return clp(unit.minor * BigInt(quantity));
}

export function calculateTax(net: Money, ratePercent: number): Money {
  if (!Number.isInteger(ratePercent) || ratePercent < 0 || ratePercent > 100) {
    throw new RangeError("La tasa debe ser un entero entre 0 y 100.");
  }
  return clp((net.minor * BigInt(ratePercent) + 50n) / 100n);
}

export function addMoney(...values: Money[]): Money {
  return clp(values.reduce((sum, value) => sum + value.minor, 0n));
}

export function formatMoney(value: Money, locale = "es-CL"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: value.currency,
    minimumFractionDigits: CLP_DECIMALS,
    maximumFractionDigits: CLP_DECIMALS,
  }).format(Number(value.minor));
}
