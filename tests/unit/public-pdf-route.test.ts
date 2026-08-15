import { describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/public/orders/[publicToken]/pdf/route";
import { findPublicOrderPdf } from "@/features/orders/pdf-service";
import { createOrderPdfResponse } from "@/features/orders/pdf";
import { isPublicOrderAccessible } from "@/features/orders/public-access";
import { hashToken } from "@/lib/security";

const routeState = vi.hoisted(() => ({
  fixtures: new Map<string, { id: string; publicTokenHash: string; status: string; publicExpiresAt: Date; publicRevokedAt: Date | null }>(),
  findPublicOrderPdf: vi.fn(),
}));

vi.mock("@/features/orders/pdf-service", () => ({ findPublicOrderPdf: routeState.findPublicOrderPdf }));
vi.mock("@/features/orders/pdf", () => ({ createOrderPdfResponse: vi.fn(async () => new Response(new Uint8Array([37, 80, 68, 70]), { headers: { "content-type": "application/pdf" } })) }));

describe("public order PDF route", () => {
  const now = new Date("2026-08-15T12:00:00.000Z");

  function configureRouteService() {
    routeState.findPublicOrderPdf.mockImplementation(async (token: string) => {
      const order = routeState.fixtures.get(token);
      return order && isPublicOrderAccessible(order, token, now) ? { id: order.id } : null;
    });
  }

  it("returns 404 for malformed and absent public tokens", async () => {
    await expect(GET(new Request("http://localhost"), { params: Promise.resolve({ publicToken: "short" }) })).resolves.toMatchObject({ status: 404 });
    routeState.findPublicOrderPdf.mockResolvedValueOnce(null);
    await expect(GET(new Request("http://localhost"), { params: Promise.resolve({ publicToken: "a".repeat(43) }) })).resolves.toMatchObject({ status: 404 });
  });

  it("returns the PDF only for a valid unexpired, unrevoked, correctly matched token", async () => {
    const tokens = {
      valid: "v".repeat(43),
      expired: "e".repeat(43),
      revoked: "r".repeat(43),
      wrong: "w".repeat(43),
    };
    routeState.fixtures.clear();
    routeState.fixtures.set(tokens.valid, { id: "valid-order", publicTokenHash: hashToken(tokens.valid), status: "issued", publicExpiresAt: new Date("2026-08-16"), publicRevokedAt: null });
    routeState.fixtures.set(tokens.expired, { id: "expired-order", publicTokenHash: hashToken(tokens.expired), status: "issued", publicExpiresAt: new Date("2026-08-14"), publicRevokedAt: null });
    routeState.fixtures.set(tokens.revoked, { id: "revoked-order", publicTokenHash: hashToken(tokens.revoked), status: "issued", publicExpiresAt: new Date("2026-08-16"), publicRevokedAt: new Date("2026-08-15") });
    routeState.fixtures.set(tokens.wrong, { id: "wrong-order", publicTokenHash: hashToken("another-token"), status: "issued", publicExpiresAt: new Date("2026-08-16"), publicRevokedAt: null });
    configureRouteService();

    const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ publicToken: tokens.valid }) });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(createOrderPdfResponse).toHaveBeenCalled();

    for (const publicToken of [tokens.expired, tokens.revoked, tokens.wrong]) {
      await expect(GET(new Request("http://localhost"), { params: Promise.resolve({ publicToken }) })).resolves.toMatchObject({ status: 404 });
    }
    expect(findPublicOrderPdf).toHaveBeenCalledWith(tokens.valid);
    expect(findPublicOrderPdf).toHaveBeenCalledWith(tokens.expired);
    expect(findPublicOrderPdf).toHaveBeenCalledWith(tokens.revoked);
    expect(findPublicOrderPdf).toHaveBeenCalledWith(tokens.wrong);
  });
});
