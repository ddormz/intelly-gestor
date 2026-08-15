import { describe, expect, it } from "vitest";
import { assertClientCanReceiveOrder, assertTransition, calculateOrder } from "@/features/orders/domain";
import { clp } from "@/lib/money";

describe("payment-order domain", () => {
  it("freezes deterministic line and order totals", () => {
    const order = calculateOrder([{ description: "Servicio", quantity: 2, unitPrice: clp(10_000), taxRate: 19 }]);
    expect(order.subtotal.minor).toBe(20_000n);
    expect(order.tax.minor).toBe(3_800n);
    expect(order.total.minor).toBe(23_800n);
  });

  it("allows only explicit financial transitions", () => {
    expect(() => assertTransition("draft", "issued")).not.toThrow();
    expect(() => assertTransition("issued", "paid")).not.toThrow();
    expect(() => assertTransition("draft", "paid")).toThrow(/No se puede/);
    expect(() => assertTransition("invoiced", "cancelled")).toThrow(/No se puede/);
  });

  it("rejects inactive clients before creating an order", () => {
    expect(() => assertClientCanReceiveOrder("active")).not.toThrow();
    expect(() => assertClientCanReceiveOrder("inactive")).toThrow(/cliente no estÃ¡ activo/i);
  });
});
