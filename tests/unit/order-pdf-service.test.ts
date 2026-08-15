import { describe, expect, it, vi } from "vitest";
import { getDb } from "@/db";
import { paymentOrderLines, paymentOrders } from "@/db/schema";
import { findOrderPdf } from "@/features/orders/pdf-service";
import { createOrderPdfResponse } from "@/features/orders/pdf";

vi.mock("@/db", () => ({ getDb: vi.fn() }));

function configurePdfDb() {
  const results: unknown[] = [
    [{ id: "order-id", number: "OP-1", status: "issued", subtotal: "1500", discountTotal: "150", discountReason: "Volumen", taxTotal: "171", total: "1521", createdAt: new Date("2026-08-15"), issuedAt: new Date("2026-08-15"), dueAt: null, clientName: "Mixto", clientTaxId: null, clientEmail: "mixto@example.com" }],
    [{ id: "taxable", code: "A", description: "Afecto", quantity: "1", subtotal: "1000", discountAmount: "100", taxRate: "19.00", taxAmount: "171", total: "1071", sortOrder: 0 }, { id: "exempt", code: "B", description: "Exento", quantity: "1", subtotal: "500", discountAmount: "50", taxRate: "0.00", taxAmount: "0", total: "450", sortOrder: 1 }],
  ];
  const selections: unknown[] = [];
  const db = {
    select: vi.fn((fields: unknown) => {
      selections.push(fields);
      const result = results.shift();
      const builder = { from: () => builder, innerJoin: () => builder, where: () => builder, orderBy: () => builder, limit: () => builder, execute: () => Promise.resolve(result) };
      return builder;
    }),
  };
  vi.mocked(getDb).mockReturnValue(db as never);
  return selections;
}

describe("order PDF production selection", () => {
  it("uses the persisted 900/450/171/1521 mixed-tax values", async () => {
    const selections = configurePdfDb();
    const order = await findOrderPdf("order-id");
    expect(selections[0]).toMatchObject({ subtotal: paymentOrders.subtotal, discountTotal: paymentOrders.discountTotal, taxTotal: paymentOrders.taxTotal, total: paymentOrders.total });
    expect(selections[1]).toMatchObject({ discountAmount: paymentOrderLines.discountAmount, taxRate: paymentOrderLines.taxRate, taxAmount: paymentOrderLines.taxAmount, total: paymentOrderLines.total });
    expect(order).toBeTruthy();
    expect(order).toMatchObject({ subtotal: 1500, discountTotal: 150, taxTotal: 171, total: 1521 });
    expect(order?.items).toMatchObject([{ netAmount: 900, taxAmount: 171, total: 1071, taxable: true }, { netAmount: 450, taxAmount: 0, total: 450, taxable: false }]);
    const response = await createOrderPdfResponse(order!);
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("%PDF");
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });
});
