import { describe, expect, it, vi } from "vitest";
import { getDb } from "@/db";
import { findActiveClient } from "@/features/clients/service";
import { searchActiveCatalog, searchActiveClients } from "@/features/orders/search";
import { buildOrderCartPayload } from "@/features/orders/pos";

vi.mock("@/db", () => ({ getDb: vi.fn() }));

function configureSearchDb(result: unknown[]) {
  const calls: Array<{ limit?: number }> = [];
  const db = {
    select: vi.fn(() => {
      const call: { limit?: number } = {};
      calls.push(call);
      const builder = {
        from: () => builder,
        where: () => builder,
        orderBy: () => builder,
        limit: (value: number) => { call.limit = value; return builder; },
        execute: () => Promise.resolve(result),
      };
      return builder;
    }),
  };
  vi.mocked(getDb).mockReturnValue(db as never);
  return calls;
}

describe("payment-order POS", () => {
  it("serializes only authoritative cart inputs", () => {
    const payload = buildOrderCartPayload({
      clientId: "client-id",
      lines: [{ catalogItemId: "item-id", quantity: 2, unitPrice: 12500, name: "No confiar", total: 999999 }],
      discountPercent: 10,
      discountReason: "Volumen",
      dueAt: "2026-09-01",
      notes: "Nota",
      expectedVersion: 4,
    });

    expect(payload).toEqual({
      clientId: "client-id",
      lines: [{ catalogItemId: "item-id", quantity: 2, unitPrice: 12500 }],
      discountPercent: 10,
      discountReason: "Volumen",
      dueAt: "2026-09-01",
      notes: "Nota",
      expectedVersion: 4,
    });
    expect(payload).not.toHaveProperty("total");
    expect(JSON.stringify(payload)).not.toContain("No confiar");
  });

  it("bounds active client and catalog searches", async () => {
    const clientCalls = configureSearchDb([{ id: "client-id", legalName: "Cliente", taxId: "76.123.456-0", email: "a@b.cl" }]);
    await expect(searchActiveClients("cliente")).resolves.toHaveLength(1);
    expect(clientCalls[0]?.limit).toBe(20);

    const catalogCalls = configureSearchDb([{ id: "item-id", code: "SERV-1", name: "Servicio", type: "service", unitPrice: "1000.00", taxCategory: "taxable", taxRate: "19.00" }]);
    await expect(searchActiveCatalog("servicio")).resolves.toHaveLength(1);
    expect(catalogCalls[0]?.limit).toBe(20);
  });

  it("can hydrate a newly created active client when returning from quick creation", async () => {
    configureSearchDb([{ id: "client-id", legalName: "Cliente nuevo", taxId: "76.123.456-0", email: "nuevo@example.com", status: "active" }]);
    await expect(findActiveClient("client-id")).resolves.toMatchObject({ id: "client-id", legalName: "Cliente nuevo" });
  });
});
