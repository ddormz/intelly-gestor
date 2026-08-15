import { describe, expect, it, vi } from "vitest";
import { getDb } from "@/db";
import { findPublicOrder } from "@/features/orders/service";
import { findPublicOrderPdf } from "@/features/orders/pdf-service";
import { hashToken } from "@/lib/security";
import { isPublicOrderAccessible } from "@/features/orders/public-access";

vi.mock("@/db", () => ({ getDb: vi.fn() }));

function configureDb(results: unknown[]) {
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

describe("public order token access", () => {
  it("evaluates token hash, status, expiry, and revocation predicates", () => {
    const token = "a".repeat(43);
    const base = { publicTokenHash: hashToken(token), status: "issued", publicExpiresAt: new Date("2026-08-16"), publicRevokedAt: null };
    expect(isPublicOrderAccessible(base, token, new Date("2026-08-15"))).toBe(true);
    expect(isPublicOrderAccessible({ ...base, publicExpiresAt: new Date("2026-08-14") }, token, new Date("2026-08-15"))).toBe(false);
    expect(isPublicOrderAccessible({ ...base, publicRevokedAt: new Date("2026-08-15") }, token, new Date("2026-08-15"))).toBe(false);
    expect(isPublicOrderAccessible({ ...base, publicTokenHash: hashToken("other-token") }, token, new Date("2026-08-15"))).toBe(false);
  });

  it("accepts a valid unexpired token through the public order function", async () => {
    const token = "a".repeat(43);
    const selections = configureDb([[{ number: "OP-1", status: "issued", total: "1521", dueAt: null, clientName: "Cliente", publicTokenHash: hashToken(token), publicExpiresAt: new Date("2099-01-01"), publicRevokedAt: null }]]);
    await expect(findPublicOrder(token)).resolves.toMatchObject({ number: "OP-1", total: "1521" });
    expect(hashToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(selections[0]).toBeTruthy();
  });

  it.each(["expired", "revoked", "wrong"])("rejects a %s token through public HTML access", async (kind) => {
    const token = `${kind}-token`;
    configureDb([[{ number: "OP-1", status: "issued", total: "1521", dueAt: null, clientName: "Cliente", publicTokenHash: hashToken(kind === "wrong" ? "other-token" : token), publicExpiresAt: kind === "expired" ? new Date("2020-01-01") : new Date("2099-01-01"), publicRevokedAt: kind === "revoked" ? new Date("2026-08-15") : null }]]);
    await expect(findPublicOrder(token)).resolves.toBeNull();
  });

  it("uses the public PDF production path for a valid token and rejects expired, revoked, and wrong tokens", async () => {
    configureDb([
      [{ id: "order-id", number: "OP-1", status: "issued", subtotal: "1500", discountTotal: "150", discountReason: "Volumen", taxTotal: "171", total: "1521", createdAt: new Date("2026-08-15"), issuedAt: new Date("2026-08-15"), dueAt: null, clientName: "Mixto", clientTaxId: null, clientEmail: "mixto@example.com", publicTokenHash: hashToken("b".repeat(43)), publicExpiresAt: new Date("2099-01-01"), publicRevokedAt: null }],
      [{ id: "taxable", code: "A", description: "Afecto", quantity: "1", subtotal: "1000", discountAmount: "100", taxRate: "19.00", taxAmount: "171", total: "1071", sortOrder: 0 }, { id: "exempt", code: "B", description: "Exento", quantity: "1", subtotal: "500", discountAmount: "50", taxRate: "0.00", taxAmount: "0", total: "450", sortOrder: 1 }],
    ]);
    const pdf = await findPublicOrderPdf("b".repeat(43));
    expect(pdf).toMatchObject({ subtotal: 1500, discountTotal: 150, taxTotal: 171, total: 1521 });
    expect(pdf?.items.map((item) => item.netAmount)).toEqual([900, 450]);

    for (const token of ["expired-token", "revoked-token", "wrong-token"]) {
      configureDb([[]]);
      await expect(findPublicOrderPdf(token)).resolves.toBeNull();
    }
  });
});
