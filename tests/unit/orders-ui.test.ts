import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { OrderManager } from "@/app/(dashboard)/ordenes/order-manager";

vi.mock("@/features/billing/actions", () => ({ issueInvoiceAction: vi.fn() }));

const query = { page: 1, pageSize: 20 };

function renderOrder(status: "issued" | "paid" | "invoiced") {
  return renderToStaticMarkup(createElement(OrderManager, {
    publicLink: undefined,
    orders: [{ id: "order-1", number: "OP-1", clientName: "Cliente", clientEmail: "cliente@example.com", status, total: "1190" }],
    canCreate: true,
    canImport: false,
    query,
    page: 1,
    pageSize: 20,
    total: 1,
  }));
}

describe("order invoicing UI", () => {
  it("offers direct invoice emission from issued and paid orders", () => {
    expect(renderOrder("issued")).toContain("Emitir factura");
    expect(renderOrder("issued")).toContain("Registrar pago");
    expect(renderOrder("paid")).toContain("Emitir factura");
    expect(renderOrder("paid")).not.toContain("Registrar pago");
    expect(renderOrder("invoiced")).not.toContain("Emitir factura");
  });
});
