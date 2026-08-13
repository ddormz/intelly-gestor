import { describe, expect, it } from "vitest";
import { addMoney, calculateTax, clp, formatMoney, multiplyMoney } from "@/lib/money";
import { redactMetadata } from "@/lib/errors";

describe("financial foundation", () => {
  it("calculates CLP totals without floating point arithmetic", () => {
    const subtotal = multiplyMoney(clp(1000), 2);
    const tax = calculateTax(subtotal, 19);
    expect(subtotal.minor).toBe(2000n);
    expect(tax.minor).toBe(380n);
    expect(addMoney(subtotal, tax).minor).toBe(2380n);
    expect(formatMoney(clp(2380))).toContain("2.380");
  });

  it("redacts secret-bearing metadata keys", () => {
    expect(redactMetadata({ orderId: "1", apiKey: "secret", password: "secret" })).toEqual({ orderId: "1", apiKey: "[REDACTED]", password: "[REDACTED]" });
  });
});
