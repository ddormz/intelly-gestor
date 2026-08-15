import { describe, expect, it, vi } from "vitest";
import { getDb } from "@/db";
import { listUsersForAdmin } from "@/features/auth/admin-service";
import { listClients } from "@/features/clients/service";
import { listCatalogItems } from "@/features/catalog/service";
import { listOrders } from "@/features/orders/service";
import { listInvoices } from "@/features/billing/service";
import { listIntegrationAttempts } from "@/features/audit/service";
import { parsePageQuery } from "@/lib/list-query";

vi.mock("@/db", () => ({ getDb: vi.fn() }));

type QueryBuilder = {
  from: () => QueryBuilder;
  innerJoin: () => QueryBuilder;
  where: (condition?: unknown) => QueryBuilder;
  orderBy: () => QueryBuilder;
  limit: (value: number) => QueryBuilder;
  offset: (value: number) => QueryBuilder;
  execute: () => Promise<unknown>;
};

function fakeDb(...results: unknown[]) {
  const calls: Array<{ limit?: number; offset?: number; where?: unknown }> = [];
  const db = {
    select: vi.fn(() => {
      const call: { limit?: number; offset?: number } = {};
      calls.push(call);
      const builder: QueryBuilder = {
        from: () => builder,
        innerJoin: () => builder,
        where: (condition) => { call.where = condition; return builder; },
        orderBy: () => builder,
        limit: (value) => { call.limit = value; return builder; },
        offset: (value) => { call.offset = value; return builder; },
        execute: () => Promise.resolve(results.shift()),
      };
      return builder;
    }),
  };
  vi.mocked(getDb).mockReturnValue(db as never);
  return { db, calls };
}

const query = parsePageQuery({ page: "2", pageSize: "10", q: "cliente", status: "active" });

describe("management list services", () => {
  it.each([
    ["users", listUsersForAdmin, { id: "u1", name: "Ana", email: "ana@example.com", role: "operator", status: "active" }],
    ["clients", listClients, { id: "c1", legalName: "Cliente", status: "active" }],
    ["catalog", listCatalogItems, { id: "i1", name: "Servicio", status: "active" }],
    ["orders", listOrders, { id: "o1", number: "OP-1", clientName: "Cliente", status: "draft", total: "1000" }],
    ["invoices", listInvoices, { id: "f1", orderNumber: "OP-1", clientName: "Cliente", status: "issued", total: "1000" }],
    ["integrations", listIntegrationAttempts, { id: "a1", operation: "issue_invoice", status: "issued", correlationId: "corr-1" }],
  ])("returns a bounded page result for %s", async (_name, service, item) => {
    const { calls } = fakeDb([item], [{ value: 21 }]);
    const result = await service(query);

    expect(result).toMatchObject({ items: [item], page: 2, pageSize: 10, total: 21 });
    expect(calls.some((call) => call.limit === 10 && call.offset === 10)).toBe(true);
  });

  it("uses the invoice status tab as a service filter", async () => {
    const { calls } = fakeDb([{ id: "f1" }], [{ value: 1 }]);

    await listInvoices(parsePageQuery({ tab: "processing" }));

    expect(calls.some((call) => call.where)).toBe(true);
  });

  it.each([
    ["clients", listClients],
    ["catalog", listCatalogItems],
  ])("uses the active/inactive tab as a %s service filter", async (_name, service) => {
    const { calls } = fakeDb([{ id: "item-1" }], [{ value: 1 }]);

    await service(parsePageQuery({ tab: "inactive" }));

    expect(calls.some((call) => call.where)).toBe(true);
  });

  it.each([
    ["clients", listClients],
    ["catalog", listCatalogItems],
  ])("does not add a status predicate for the all tab on %s", async (_name, service) => {
    const { calls } = fakeDb([{ id: "item-1" }], [{ value: 1 }]);

    await service(parsePageQuery({ tab: "all" }));

    expect(calls.some((call) => call.where)).toBe(false);
  });
});
