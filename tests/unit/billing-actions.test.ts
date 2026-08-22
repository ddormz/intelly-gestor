import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/auth/session", () => ({ requireUser: vi.fn(async () => ({ userId: "user-1", name: "Usuario" })) }));
vi.mock("@/lib/security", () => ({ enforceSameOrigin: vi.fn(async () => undefined) }));
vi.mock("@/features/billing/emission", () => ({
  issueInvoice: vi.fn(async () => ({ kind: "issued", providerDocumentId: "dte-1", folio: "22", issuedAt: "2026-08-15T12:00:00.000Z", siiStatus: "DOK" })),
  refreshInvoiceStatus: vi.fn(),
}));
vi.mock("@/features/billing/service", () => ({ importHistoricalInvoices: vi.fn(), sendInvoiceEmail: vi.fn() }));
vi.mock("@/features/integrations/intellydte", () => ({ getIntellyDteGateway: vi.fn() }));
vi.mock("@/features/audit/service", () => ({ writeAudit: vi.fn() }));

import { issueInvoiceAction } from "@/features/billing/actions";

describe("billing server actions", () => {
  it("reports SII acceptance without claiming a pending PDF exists", async () => {
    const formData = new FormData();
    formData.set("orderId", "order-1");

    const result = await issueInvoiceAction({ status: "idle" }, formData);

    expect(result).toEqual({ status: "success", message: "Factura aceptada por el SII." });
  });
});
