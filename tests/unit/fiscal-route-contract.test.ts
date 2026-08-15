import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/session", () => ({ requireUser: vi.fn(async () => ({ userId: "user-1", role: "operator" })) }));
vi.mock("@/features/billing/emission", () => ({ refreshInvoiceStatus: vi.fn(async () => ({ kind: "pending", providerDocumentId: "dte-1" })) }));

import { POST } from "@/app/api/invoices/[id]/status/route";

describe("authenticated fiscal status route", () => {
  it("refreshes status through the server-side provider gateway", async () => {
    const response = await POST(new Request("http://localhost/api/invoices/invoice-1/status", { method: "POST" }), { params: Promise.resolve({ id: "invoice-1" }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true, result: { kind: "pending" } });
  });
});
