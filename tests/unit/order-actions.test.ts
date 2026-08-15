import { describe, expect, it, vi } from "vitest";
import { getDb } from "@/db";
import { createOrderFromCart, issueOrder, markOrderPaid, updateOrderFromCart } from "@/features/orders/service";
import { orderCartSchema } from "@/features/orders/validation";
import { hashToken } from "@/lib/security";

vi.mock("@/db", () => ({ getDb: vi.fn() }));
vi.mock("@/features/orders/public-token", () => ({ decryptPublicToken: vi.fn(() => "current-token"), encryptPublicToken: vi.fn(() => ({ ciphertext: "cipher", iv: "iv", authTag: "tag" })) }));

const clientId = "4fc73a41-4f1f-4bd1-a775-21b93af922d4";
const itemId = "9d4a2e06-79a9-4f88-91c4-4f2d7d4d6ac0";

describe("payment-order cart contract", () => {
  function configureDb(selectResults: unknown[], updateAffectedRows = 1) {
    const inserts: unknown[] = [];
    const updates: unknown[] = [];
    const tx = {
      select: vi.fn(() => {
        const result = selectResults.shift();
        const builder = {
          from: () => builder,
          innerJoin: () => builder,
          where: () => builder,
          orderBy: () => builder,
          limit: () => builder,
          for: () => builder,
          execute: () => Promise.resolve(result),
        };
        return builder;
      }),
      insert: vi.fn(() => ({ values: vi.fn((value: unknown) => { inserts.push(value); return Promise.resolve(); }) })),
      update: vi.fn(() => ({ set: (value: unknown) => { updates.push(value); return { where: () => ({ execute: () => Promise.resolve([{ affectedRows: updateAffectedRows }]) }) }; } })),
      delete: vi.fn(() => ({ where: () => ({ execute: () => Promise.resolve() }) })),
    };
    const db = { transaction: vi.fn((callback: (value: typeof tx) => unknown) => callback(tx)) };
    vi.mocked(getDb).mockReturnValue(db as never);
    return { inserts, updates };
  }

  it("accepts multiple normalized lines and order metadata", () => {
    const parsed = orderCartSchema.parse({
      clientId,
      lines: [
        { catalogItemId: itemId, quantity: "2", unitPrice: "12000" },
        { catalogItemId: "7c9b1b6a-d93b-4f4b-a35e-4f2d7d4d6ac0", quantity: 1, unitPrice: 5000 },
      ],
      discountPercent: "10",
      discountReason: " Descuento por volumen ",
      dueAt: "2026-09-01",
      notes: "Pago dentro de 30 dias",
      expectedVersion: "3",
    });

    expect(parsed).toMatchObject({
      clientId,
      discountPercent: 10,
      discountReason: "Descuento por volumen",
      expectedVersion: 3,
    });
    expect(parsed.lines).toHaveLength(2);
    expect(parsed.lines[0]).toEqual({ catalogItemId: itemId, quantity: 2, unitPrice: 12000 });
    expect(parsed).not.toHaveProperty("total");
    expect(parsed).not.toHaveProperty("tax");
  });

  it("requires a non-empty cart and discount reason", () => {
    expect(orderCartSchema.safeParse({ clientId, lines: [] }).success).toBe(false);
    expect(orderCartSchema.safeParse({
      clientId,
      lines: [{ catalogItemId: itemId, quantity: 1, unitPrice: 1000 }],
      discountPercent: 5,
      discountReason: " ",
    }).success).toBe(false);
    expect(orderCartSchema.safeParse({ clientId, lines: [{ catalogItemId: itemId, quantity: 1, unitPrice: 0 }] }).success).toBe(true);
    expect(orderCartSchema.safeParse({ clientId, lines: [{ catalogItemId: itemId, quantity: 1, unitPrice: "1.5" }] }).success).toBe(false);
  });

  it("allows a bounded operator override and rejects an unsafe override", async () => {
    const { inserts } = configureDb([
      [{ id: clientId, status: "active" }],
      [{ id: itemId, status: "active", code: "SERV-1", name: "Servicio del servidor", unitPrice: "1000.00", taxCategory: "taxable", taxRate: "19.00" }],
    ]);

    await createOrderFromCart({
      clientId,
      lines: [{ catalogItemId: itemId, quantity: 2, unitPrice: 1100 }],
      discountPercent: 0,
      discountReason: "",
    }, "user-id", "operator");

    const line = inserts.find((value) => Array.isArray(value) && value.some((item) => item.description === "Servicio del servidor")) as Array<Record<string, unknown>>;
    expect(line[0]).toMatchObject({ code: "SERV-1", description: "Servicio del servidor", unitPrice: "1100", taxRate: "19.00" });

    configureDb([
      [{ id: clientId, status: "active" }],
      [{ id: itemId, status: "active", code: "SERV-1", name: "Servicio del servidor", unitPrice: "1000.00", taxCategory: "taxable", taxRate: "19.00" }],
    ]);
    await expect(createOrderFromCart({ clientId, lines: [{ catalogItemId: itemId, quantity: 1, unitPrice: 7500 }], discountPercent: 0, discountReason: "" }, "user-id", "operator")).rejects.toMatchObject({ code: "PRICE_OVERRIDE_OUT_OF_RANGE" });
  });

  it("rejects an optimistic version conflict before mutating an order", async () => {
    configureDb([[{ id: "order-id", status: "draft", version: 3 }]]);

    await expect(updateOrderFromCart({
      id: "order-id",
      clientId,
      lines: [{ catalogItemId: itemId, quantity: 1, unitPrice: 1000 }],
      discountPercent: 0,
      discountReason: "",
    }, "user-id", 2)).rejects.toMatchObject({ code: "ORDER_VERSION_CONFLICT" });
  });

  it("persists all changed public financial data and exposes the replacement token", async () => {
    const dueAt = new Date("2026-10-01T00:00:00.000Z");
    const { updates, inserts } = configureDb([
      [{ id: "order-id", status: "issued", version: 2, clientId, discountPercent: "0.00", discountReason: null, dueAt: null, notes: null, publicTokenHash: "old-hash" }],
      [{ id: clientId, status: "active" }],
      [{ id: "old-line", paymentOrderId: "order-id", catalogItemId: itemId, code: "SERV-1", description: "Anterior", quantity: "1", unitPrice: "1000.00", discountAmount: "0", taxRate: "19.00", subtotal: "1000", taxAmount: "190", total: "1190", sortOrder: 0 }],
      [{ id: itemId, status: "active", code: "SERV-1", name: "Actualizado", unitPrice: "1000.00", taxCategory: "taxable", taxRate: "19.00" }],
    ]);

    const result = await updateOrderFromCart({ id: "order-id", clientId, lines: [{ catalogItemId: itemId, quantity: 2, unitPrice: 1100 }], discountPercent: 10, discountReason: "Volumen", dueAt, notes: "Visible" }, "user-id", 2, "operator");
    expect(result.publicToken).toEqual(expect.any(String));
    expect(result.publicLink).toMatch(/^\/orden\//);
    expect(updates[0]).toMatchObject({ dueAt, notes: "Visible", discountPercent: "10.00", publicTokenHash: hashToken(result.publicToken!), publicRevokedAt: null });
    expect(inserts.some((value) => value && typeof value === "object" && !Array.isArray(value) && (value as { action?: string }).action === "order.updated")).toBe(true);
  });

  it("does not update an order when a submitted catalog item is inactive", async () => {
    const { updates } = configureDb([
      [{ id: "order-id", status: "draft", version: 1, clientId }],
      [{ id: clientId, status: "active" }],
      [],
      [{ id: itemId, status: "inactive", code: "SERV-1", name: "Inactivo", unitPrice: "1000.00", taxCategory: "taxable", taxRate: "19.00" }],
    ]);

    await expect(updateOrderFromCart({ id: "order-id", clientId, lines: [{ catalogItemId: itemId, quantity: 1, unitPrice: 1000 }], discountPercent: 0, discountReason: "" }, "user-id", 1, "operator")).rejects.toMatchObject({ code: "ITEM_NOT_FOUND" });
    expect(updates).toEqual([]);
  });

  it("uses a locked versioned issue write and exposes the new public token", async () => {
    const { updates } = configureDb([[{ id: "order-id", status: "draft", version: 4, total: "1190" }]]);
    const token = await issueOrder("order-id", "user-id");
    expect(token).toEqual(expect.any(String));
    expect(updates[0]).toMatchObject({ status: "issued", version: 5, publicTokenHash: hashToken(token) });
  });

  it("rejects a zero-affected-row issue write", async () => {
    configureDb([[{ id: "order-id", status: "draft", version: 4, total: "1190" }]], 0);
    await expect(issueOrder("order-id", "user-id")).rejects.toMatchObject({ code: "ORDER_VERSION_CONFLICT" });
  });

  it("rejects an order with a non-positive persisted total before issuing", async () => {
    configureDb([[{ id: "order-id", status: "draft", version: 4, total: "0.00" }]]);
    await expect(issueOrder("order-id", "user-id")).rejects.toMatchObject({ code: "ORDER_TOTAL_INVALID" });
  });

  it("checks the affected row when recording payment", async () => {
    const { updates } = configureDb([
      [],
      [{ id: "order-id", status: "issued", version: 2, total: "1190", currency: "CLP" }],
    ]);
    await markOrderPaid("order-id", "user-id", "payment-key");
    expect(updates[0]).toMatchObject({ status: "paid", version: 3 });
  });

  it("rejects a zero-affected-row payment write", async () => {
    const { updates } = configureDb([
      [],
      [{ id: "order-id", status: "issued", version: 2, total: "1190", currency: "CLP" }],
    ], 0);

    await expect(markOrderPaid("order-id", "user-id", "payment-key-zero-row")).rejects.toMatchObject({ code: "ORDER_VERSION_CONFLICT" });
    expect(updates[0]).toMatchObject({ status: "paid", version: 3 });
  });

  it("rejects a zero-affected-row order update before replacing lines", async () => {
    const { inserts } = configureDb([
      [{ id: "order-id", status: "draft", version: 1, clientId }],
      [{ id: clientId, status: "active" }],
      [{ id: "old-line", paymentOrderId: "order-id", catalogItemId: itemId, code: "SERV-1", description: "Anterior", quantity: "1", unitPrice: "1000.00", discountAmount: "0", taxRate: "19.00", subtotal: "1000", taxAmount: "190", total: "1190", sortOrder: 0 }],
      [{ id: itemId, status: "active", code: "SERV-1", name: "Actualizado", unitPrice: "1000.00", taxCategory: "taxable", taxRate: "19.00" }],
    ], 0);
    await expect(updateOrderFromCart({ id: "order-id", clientId, lines: [{ catalogItemId: itemId, quantity: 1, unitPrice: 1000 }], discountPercent: 0, discountReason: "" }, "user-id", 1, "operator")).rejects.toMatchObject({ code: "ORDER_VERSION_CONFLICT" });
    expect(inserts.some((value) => Array.isArray(value) && value.some((item) => item.paymentOrderId === "order-id"))).toBe(false);
  });
});
