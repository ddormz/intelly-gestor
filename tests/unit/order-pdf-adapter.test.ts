import { describe, expect, it } from "vitest";
import { INTELLY_PDF_SETTINGS, toLegacyPaymentOrder } from "@/features/orders/pdf";
import { resolveCommercialTotals } from "../../lib/order-pdf";

describe("order PDF adapter", () => {
  it("maps a database order to the legacy Intelly PDF contract", () => {
    const order = toLegacyPaymentOrder({
      id: "order-1",
      number: "OP-20260814-ABC123",
      status: "issued",
      subtotal: "100000.00",
      discountTotal: "0.00",
      taxTotal: "19000.00",
      createdAt: new Date("2026-08-14T12:00:00.000Z"),
      issuedAt: new Date("2026-08-14T12:05:00.000Z"),
      dueAt: new Date("2026-08-24T12:00:00.000Z"),
      clientName: "Cliente SpA",
      clientTaxId: "77.111.222-3",
      clientEmail: "pagos@cliente.cl",
    }, [{ id: "line-1", code: "HOST-01", description: "Hosting anual", quantity: "2.000", subtotal: "100000.00" }]);

    expect(order).toMatchObject({
      number: "OP-20260814-ABC123",
      committed: true,
      issueDate: "2026-08-14",
      dueDate: "2026-08-24",
      customerName: "Cliente SpA",
      customerRut: "77.111.222-3",
      customerEmail: "pagos@cliente.cl",
      invoice: true,
      items: [{ name: "Hosting anual", description: "HOST-01 · Cantidad: 2", amount: 100000 }],
    });
    expect(INTELLY_PDF_SETTINGS.companyName).toBe("INTELLY SPA");
    expect(INTELLY_PDF_SETTINGS.bankName).toBe("Banco de Chile");
  });

  it("uses the original ten-day term when no due date was stored", () => {
    const order = toLegacyPaymentOrder({
      id: "order-2", number: "OP-2", status: "draft", subtotal: "50000.00", discountTotal: "0", taxTotal: "0",
      createdAt: new Date("2026-08-14T12:00:00.000Z"), issuedAt: null, dueAt: null,
      clientName: "Persona", clientTaxId: null, clientEmail: "persona@example.com",
    }, [{ id: "line-2", code: null, description: "Servicio", quantity: "1.000", subtotal: "50000.00" }]);
    expect(order.dueDate).toBe("2026-08-24");
    expect(order.invoice).toBe(false);
  });

  it("preserves persisted mixed-tax line values and order totals", () => {
    const order = toLegacyPaymentOrder({
      id: "order-3", number: "OP-3", status: "issued", subtotal: "1500", discountTotal: "150", taxTotal: "171", total: "1521",
      createdAt: new Date("2026-08-14T12:00:00.000Z"), issuedAt: new Date("2026-08-14T12:00:00.000Z"), dueAt: null,
      clientName: "Mixto", clientTaxId: null, clientEmail: "mixto@example.com",
    }, [
      { id: "taxable", code: "A", description: "Afecto", quantity: "1", subtotal: "1000", discountAmount: "100", taxRate: "19.00", taxAmount: "171", total: "1071" },
      { id: "exempt", code: "B", description: "Exento", quantity: "1", subtotal: "500", discountAmount: "50", taxRate: "0.00", taxAmount: "0", total: "450" },
    ]);

    expect(order).toMatchObject({ subtotal: 1500, discountTotal: 150, taxTotal: 171, total: 1521 });
    expect(order.items).toMatchObject([
      { amount: 1000, discountAmount: 100, netAmount: 900, taxRate: 19, taxAmount: 171, total: 1071, taxable: true },
      { amount: 500, discountAmount: 50, netAmount: 450, taxRate: 0, taxAmount: 0, total: 450, taxable: false },
    ]);
    expect(resolveCommercialTotals(order)).toEqual({ subtotal: 1500, discount: 150, taxableBase: 900, exemptBase: 450, tax: 171, total: 1521 });
  });
});
