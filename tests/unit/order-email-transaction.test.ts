import { describe, expect, it, vi } from "vitest";
import { sendOrderEmail, type OrderEmailDependencies } from "@/features/orders/email-service";

function fakeRuntime(options: { commitFailure?: boolean; sendFailure?: boolean } = {}) {
  const state: { order: Record<string, unknown>; pending: Record<string, unknown> | null } = {
    order: { id: "order-id", number: "OP-1", status: "issued", version: 4, publicTokenHash: "old-hash", publicTokenCiphertext: "cipher", publicTokenIv: "iv", publicTokenAuthTag: "tag", clientEmail: "cliente@example.com", clientName: "Cliente" },
    pending: null,
  };
  let sends = 0;
  function predicateValues(predicate: unknown): unknown[] {
    const values: unknown[] = [];
    const visit = (value: unknown) => {
      if (!value || typeof value !== "object") return;
      const candidate = value as { queryChunks?: unknown[]; value?: unknown };
      if (candidate.queryChunks) {
        candidate.queryChunks.forEach(visit);
      } else if (Object.prototype.hasOwnProperty.call(candidate, "value") && !Array.isArray(candidate.value)) {
        values.push(candidate.value);
      }
    };
    visit(predicate);
    return values;
  }
  function matches(row: Record<string, unknown> | null, predicate: unknown) {
    if (!row) return false;
    return predicateValues(predicate).every((expected) => Object.values(row).some((actual) => String(actual) === String(expected)));
  }
  const db = {
    select: vi.fn((fields: unknown) => {
      const orderQuery = Object.prototype.hasOwnProperty.call(fields as object, "clientEmail") || Object.prototype.hasOwnProperty.call(fields as object, "version");
      let predicate: unknown;
      const builder = {
        from: () => builder,
        innerJoin: () => builder,
        where: (value: unknown) => { predicate = value; return builder; },
        limit: () => builder,
        for: () => builder,
        execute: () => Promise.resolve(orderQuery ? (matches(state.order, predicate) ? [state.order] : []) : (matches(state.pending, predicate) ? [state.pending] : [])),
      };
      return builder;
    }),
    update: vi.fn(() => ({
      set: (changes: Record<string, unknown>) => ({
        where: (predicate: unknown) => ({
          execute: () => {
            const target = Object.prototype.hasOwnProperty.call(changes, "version") ? state.order : state.pending;
            if (!matches(target, predicate)) return Promise.resolve([{ affectedRows: 0 }]);
            if (Object.prototype.hasOwnProperty.call(changes, "version")) state.order = { ...state.order, ...changes };
            else state.pending = { ...state.pending!, ...changes };
            return Promise.resolve([{ affectedRows: 1 }]);
          },
        }),
      }),
    })),
    insert: vi.fn(() => ({ values: (value: Record<string, unknown>) => { state.pending = value; return Promise.resolve(); } })),
    transaction: async (callback: (tx: typeof db) => Promise<unknown>) => {
      const before = { order: { ...state.order }, pending: state.pending ? { ...state.pending } : null };
      try {
        const result = await callback(db);
        if (options.commitFailure) throw new Error("commit failed");
        return result;
      } catch (error) {
        state.order = before.order;
        state.pending = before.pending;
        throw error;
      }
    },
  };
  const send = vi.fn(async () => {
    sends++;
    if (options.sendFailure) throw new Error("smtp uncertain");
  });
  const dependencies: OrderEmailDependencies = {
    database: () => db as never,
    transaction: (callback) => db.transaction(callback as never) as never,
    findOrderPdf: async () => ({}) as never,
    createOrderPdfBytes: async () => new Uint8Array([1, 2, 3]),
    sendOrderMessage: send,
    decryptPublicToken: () => "current-token",
    appUrl: () => "https://app.example",
  };
  return { state, send, get sends() { return sends; }, dependencies };
}

describe("order email transaction durability", () => {
  it("sends nothing when the durable preparation commit fails and can retry once", async () => {
    const runtime = fakeRuntime({ commitFailure: true });
    await expect(sendOrderEmail("order-id", "user-id", runtime.dependencies)).rejects.toThrow("commit failed");
    expect(runtime.sends).toBe(0);
    expect(runtime.state.pending).toBeNull();

    const retry = fakeRuntime();
    await sendOrderEmail("order-id", "user-id", retry.dependencies);
    expect(retry.sends).toBe(1);
  });

  it("does not send a duplicate after SMTP failure leaves a pending delivery", async () => {
    const runtime = fakeRuntime({ sendFailure: true });
    await expect(sendOrderEmail("order-id", "user-id", runtime.dependencies)).rejects.toThrow("smtp uncertain");
    expect(runtime.sends).toBe(1);
    expect(runtime.state.pending).toMatchObject({ status: "pending" });
    await expect(sendOrderEmail("order-id", "user-id", runtime.dependencies)).rejects.toMatchObject({ code: "ORDER_EMAIL_IN_PROGRESS" });
    expect(runtime.sends).toBe(1);
  });

  it("records a successful send on the same stable delivery row", async () => {
    const runtime = fakeRuntime();
    await expect(sendOrderEmail("order-id", "user-id", runtime.dependencies)).resolves.toMatchObject({ publicLink: "/orden/current-token" });
    expect(runtime.state.pending).toMatchObject({ id: expect.any(String), paymentOrderId: "order-id", status: "sent", createdBy: "user-id" });
    expect(runtime.sends).toBe(1);
  });
});
