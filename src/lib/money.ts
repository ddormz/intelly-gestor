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
  if (!Number.isFinite(ratePercent) || ratePercent < 0 || ratePercent > 100 || Math.abs(ratePercent * 100 - Math.round(ratePercent * 100)) > Number.EPSILON) {
    throw new RangeError("La tasa debe estar entre 0 y 100 con hasta dos decimales.");
  }
  const rateBasisPoints = BigInt(Math.round(ratePercent * 100));
  return clp((net.minor * rateBasisPoints + 5_000n) / 10_000n);
}

export function percentageOfMoney(value: Money, percent: number): Money {
  if (!Number.isFinite(percent) || percent < 0 || percent > 100 || Math.abs(percent * 100 - Math.round(percent * 100)) > Number.EPSILON) {
    throw new RangeError("El porcentaje debe estar entre 0 y 100 con hasta dos decimales.");
  }
  const basisPoints = BigInt(Math.round(percent * 100));
  return clp((value.minor * basisPoints + 5_000n) / 10_000n);
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

export function formatClpAmount(value: string | number | bigint, locale = "es-CL"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: CLP_DECIMALS,
    maximumFractionDigits: CLP_DECIMALS,
  }).format(Number(value));
}
