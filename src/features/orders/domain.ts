import { AppError } from "@/lib/errors";
import { addMoney, calculateTax, clp, multiplyMoney, type Money } from "@/lib/money";

export type OrderStatus = "draft" | "issued" | "paid" | "expired" | "cancelled" | "invoiced";
export type OrderLineInput = {
  catalogItemId?: string;
  code?: string | null;
  description: string;
  quantity: number;
  unitPrice: Money;
  taxRate: number;
  taxCategory?: "taxable" | "exempt";
};

export type CalculatedOrderLine = OrderLineInput & {
  subtotal: Money;
  discountAmount: Money;
  discountedSubtotal: Money;
  tax: Money;
  taxAmount: Money;
  total: Money;
};

export type OrderTotals = {
  lines: CalculatedOrderLine[];
  subtotal: Money;
  discount: Money;
  taxableBase: Money;
  exemptBase: Money;
  tax: Money;
  total: Money;
  discountPercent: number;
  discountReason: string;
};

export function assertClientCanReceiveOrder(status: "active" | "inactive"): void {
  if (status !== "active") throw new AppError("CLIENT_INACTIVE", "El cliente no está activo.", 409);
}

export function assertOrderTotalPositive(total: string | number): void {
  if (!Number.isFinite(Number(total)) || Number(total) <= 0) throw new AppError("ORDER_TOTAL_INVALID", "La orden debe tener un total positivo antes de emitirse.", 409);
}

function percentBasisPoints(percent: number): bigint {
  if (!Number.isFinite(percent) || percent < 0 || percent > 100 || Math.abs(percent * 100 - Math.round(percent * 100)) > Number.EPSILON) {
    throw new AppError("INVALID_DISCOUNT_PERCENT", "El porcentaje de descuento debe estar entre 0 y 100.");
  }
  return BigInt(Math.round(percent * 100));
}

export function allocateProportionalDiscount(subtotals: bigint[], discount: bigint): bigint[] {
  if (subtotals.length === 0 || subtotals.some((subtotal) => subtotal < 0n)) throw new AppError("INVALID_DISCOUNT_ALLOCATION", "No se pudo distribuir el descuento.");
  const subtotal = subtotals.reduce((sum, value) => sum + value, 0n);
  if (discount < 0n || discount > subtotal) throw new AppError("INVALID_DISCOUNT_ALLOCATION", "El descuento supera la base de la orden.");
  if (discount === 0n) return subtotals.map(() => 0n);

  const allocations = subtotals.map((lineSubtotal) => (discount * lineSubtotal) / subtotal);
  let allocated = allocations.reduce((sum, value) => sum + value, 0n);
  let remaining = discount - allocated;
  const remainderOrder = subtotals.map((lineSubtotal, index) => ({ index, remainder: (discount * lineSubtotal) % subtotal }))
    .sort((left, right) => right.remainder > left.remainder ? 1 : right.remainder < left.remainder ? -1 : right.index - left.index);

  for (const candidate of remainderOrder) {
    if (remaining === 0n) break;
    const capacity = subtotals[candidate.index]! - allocations[candidate.index]!;
    if (capacity > 0n) {
      allocations[candidate.index]! += 1n;
      allocated += 1n;
      remaining -= 1n;
    }
  }
  if (remaining !== 0n || allocated !== discount || allocations.some((value, index) => value < 0n || value > subtotals[index]!)) throw new AppError("INVALID_DISCOUNT_ALLOCATION", "No se pudo distribuir el descuento sin afectar las bases.");
  return allocations;
}

export function calculateOrder(lines: OrderLineInput[], discountPercent = 0, discountReason = ""): OrderTotals {
  if (lines.length === 0) throw new AppError("EMPTY_ORDER", "Agrega al menos un concepto.");
  const basisPoints = percentBasisPoints(discountPercent);
  const normalizedReason = discountReason.trim();
  if (basisPoints > 0n && !normalizedReason) throw new AppError("DISCOUNT_REASON_REQUIRED", "Indica el motivo del descuento.");

  const withSubtotals = lines.map((line) => {
    const subtotal = multiplyMoney(line.unitPrice, line.quantity);
    return { line, subtotal };
  });
  const subtotal = addMoney(...withSubtotals.map((line) => line.subtotal));
  const discount = clp((subtotal.minor * basisPoints + 5_000n) / 10_000n);
  const allocatedDiscounts = allocateProportionalDiscount(withSubtotals.map(({ subtotal: lineSubtotal }) => lineSubtotal.minor), discount.minor);
  const calculated = withSubtotals.map(({ line, subtotal: lineSubtotal }, index) => {
    const discountAmount = clp(allocatedDiscounts[index]!);
    const discountedSubtotal = clp(lineSubtotal.minor - discountAmount.minor);
    const taxable = line.taxCategory === "taxable" || (line.taxCategory === undefined && line.taxRate > 0);
    const tax = taxable ? calculateTax(discountedSubtotal, line.taxRate) : clp(0);
    return { ...line, subtotal: lineSubtotal, discountAmount, discountedSubtotal, tax, taxAmount: tax, total: addMoney(discountedSubtotal, tax) };
  });
  const taxableBase = addMoney(...calculated.filter((line) => line.taxCategory === "taxable" || (line.taxCategory === undefined && line.taxRate > 0)).map((line) => line.discountedSubtotal));
  const exemptBase = addMoney(...calculated.filter((line) => line.taxCategory === "exempt" || (line.taxCategory === undefined && line.taxRate === 0)).map((line) => line.discountedSubtotal));
  return {
    lines: calculated,
    subtotal,
    discount,
    taxableBase,
    exemptBase,
    tax: addMoney(...calculated.map((line) => line.tax)),
    total: addMoney(...calculated.map((line) => line.total)),
    discountPercent,
    discountReason: normalizedReason,
  };
}

export function assertEditableOrder(status: OrderStatus): void {
  if (status !== "draft" && status !== "issued") throw new AppError("ORDER_NOT_EDITABLE", "La orden no permite cambios financieros.", 409);
}

export function assertFinancialEditAllowed(status: OrderStatus): void {
  assertEditableOrder(status);
}

export function canCreateOrder(hasActiveClient: boolean, hasActiveCatalogItem: boolean): boolean {
  return hasActiveClient && hasActiveCatalogItem;
}

const transitions: Record<OrderStatus, OrderStatus[]> = {
  draft: ["issued", "cancelled"],
  issued: ["paid", "expired", "cancelled"],
  paid: ["invoiced"],
  expired: ["cancelled"],
  cancelled: [],
  invoiced: [],
};

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!transitions[from].includes(to)) throw new AppError("INVALID_ORDER_TRANSITION", `No se puede cambiar una orden de ${from} a ${to}.`, 409);
}
