import { AppError } from "@/lib/errors";
import { addMoney, calculateTax, clp, multiplyMoney, type Money } from "@/lib/money";

export type OrderStatus = "draft" | "issued" | "paid" | "expired" | "cancelled" | "invoiced";
export type OrderLineInput = { description: string; quantity: number; unitPrice: Money; taxRate: number };

export function calculateOrder(lines: OrderLineInput[]) {
  if (lines.length === 0) throw new AppError("EMPTY_ORDER", "Agrega al menos un concepto.");
  const calculated = lines.map((line) => {
    const subtotal = multiplyMoney(line.unitPrice, line.quantity);
    const tax = calculateTax(subtotal, line.taxRate);
    return { ...line, subtotal, tax, total: addMoney(subtotal, tax) };
  });
  return {
    lines: calculated,
    subtotal: addMoney(...calculated.map((line) => line.subtotal)),
    tax: addMoney(...calculated.map((line) => line.tax)),
    total: addMoney(...calculated.map((line) => line.total)),
    discount: clp(0),
  };
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
