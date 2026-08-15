import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { assertClientCanReceiveOrder, assertFinancialEditAllowed, assertEditableOrder, assertTransition, calculateOrder, canCreateOrder } from "@/features/orders/domain";
import { validateUnitPriceOverride } from "@/features/orders/price-policy";
import { clp } from "@/lib/money";

describe("payment-order domain", () => {
  it("freezes deterministic line and order totals", () => {
    const order = calculateOrder([{ description: "Servicio", quantity: 2, unitPrice: clp(10_000), taxRate: 19 }]);
    expect(order.subtotal.minor).toBe(20_000n);
    expect(order.discount.minor).toBe(0n);
    expect(order.taxableBase.minor).toBe(20_000n);
    expect(order.exemptBase.minor).toBe(0n);
    expect(order.tax.minor).toBe(3_800n);
    expect(order.total.minor).toBe(23_800n);
  });

  it("allocates a global discount across taxable and exempt lines", () => {
    const order = calculateOrder([
      { description: "Servicio", quantity: 1, unitPrice: clp(1_000), taxRate: 19 },
      { description: "Producto exento", quantity: 1, unitPrice: clp(500), taxRate: 0 },
    ], 10, "Descuento comercial");

    expect(order.discount.minor).toBe(150n);
    expect(order.lines.map((line) => line.discountAmount.minor)).toEqual([100n, 50n]);
    expect(order.taxableBase.minor).toBe(900n);
    expect(order.exemptBase.minor).toBe(450n);
    expect(order.tax.minor).toBe(171n);
    expect(order.total.minor).toBe(1_521n);
  });

  it("does not calculate tax when a line is explicitly exempt", () => {
    const order = calculateOrder([{ description: "Exento", quantity: 1, unitPrice: clp(1_000), taxRate: 19, taxCategory: "exempt" }]);
    expect(order.exemptBase.minor).toBe(1_000n);
    expect(order.tax.minor).toBe(0n);
    expect(order.total.minor).toBe(1_000n);
  });

  it("requires a reason for a positive discount and permits zero discount without one", () => {
    expect(() => calculateOrder([{ description: "Servicio", quantity: 1, unitPrice: clp(100), taxRate: 19 }], 10, " ")).toThrow(AppError);
    expect(calculateOrder([{ description: "Servicio", quantity: 1, unitPrice: clp(100), taxRate: 19 }], 0).discount.minor).toBe(0n);
    expect(() => calculateOrder([{ description: "Servicio", quantity: 1, unitPrice: clp(100), taxRate: 19 }], 101, "Descuento")).toThrow(/porcentaje/i);
  });

  it("assigns proportional rounding remainder to the final line", () => {
    const order = calculateOrder([
      { description: "A", quantity: 1, unitPrice: clp(1), taxRate: 0 },
      { description: "B", quantity: 1, unitPrice: clp(1), taxRate: 0 },
      { description: "C", quantity: 1, unitPrice: clp(1), taxRate: 0 },
    ], 33, "Descuento");

    expect(order.discount.minor).toBe(1n);
    expect(order.lines.map((line) => line.discountAmount.minor)).toEqual([0n, 0n, 1n]);
    expect(order.lines.reduce((sum, line) => sum + line.discountAmount.minor, 0n)).toBe(order.discount.minor);
  });

  it("allocates a large-cart discount without negative bases", () => {
    const order = calculateOrder(Array.from({ length: 100 }, (_, index) => ({ description: `Linea ${index + 1}`, quantity: 1, unitPrice: clp(1), taxRate: 0 })), 50, "Volumen");
    expect(order.discount.minor).toBe(50n);
    expect(order.lines.every((line) => line.discountedSubtotal.minor >= 0n)).toBe(true);
    expect(order.lines.filter((line) => line.discountAmount.minor === 1n)).toHaveLength(50);
    expect(order.lines.reduce((sum, line) => sum + line.discountAmount.minor, 0n)).toBe(50n);
  });

  it("enforces role-based integer CLP price overrides", () => {
    expect(validateUnitPriceOverride(1_100, "1000.00", "operator")).toBe(1_100);
    expect(() => validateUnitPriceOverride(2_000, "1000.00", "operator")).toThrow(/rango/i);
    expect(validateUnitPriceOverride(0, "1000.00", "admin")).toBe(0);
    expect(() => validateUnitPriceOverride(-1, "1000.00", "admin")).toThrow(/entre 0/i);
    expect(() => validateUnitPriceOverride(Number.MAX_SAFE_INTEGER + 1, "1000.00", "admin")).toThrow(/máximo/i);
    expect(() => validateUnitPriceOverride(1.5, "1000.00", "admin")).toThrow(/entero/i);
  });

  it("rejects financial edits to settled orders", () => {
    expect(() => assertEditableOrder("draft")).not.toThrow();
    expect(() => assertEditableOrder("issued")).not.toThrow();
    for (const status of ["paid", "invoiced", "cancelled", "expired"] as const) {
      expect(() => assertEditableOrder(status)).toThrow(/orden no permite/i);
      expect(() => assertFinancialEditAllowed(status)).toThrow(/orden no permite/i);
    }
    expect(() => assertFinancialEditAllowed("issued")).not.toThrow();
  });

  it("allows only explicit financial transitions", () => {
    expect(() => assertTransition("draft", "issued")).not.toThrow();
    expect(() => assertTransition("issued", "paid")).not.toThrow();
    expect(() => assertTransition("draft", "paid")).toThrow(/No se puede/);
    expect(() => assertTransition("invoiced", "cancelled")).toThrow(/No se puede/);
  });

  it("rejects inactive clients before creating an order", () => {
    expect(() => assertClientCanReceiveOrder("active")).not.toThrow();
    expect(() => assertClientCanReceiveOrder("inactive")).toThrow(/cliente no está activo/i);
  });

  it("does not depend on a paginated selector array to enable creation", () => {
    expect(canCreateOrder(true, true)).toBe(true);
    expect(canCreateOrder(false, true)).toBe(false);
    expect(canCreateOrder(true, false)).toBe(false);
  });
});
