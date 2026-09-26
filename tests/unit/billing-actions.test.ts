import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  issueInvoice: vi.fn(),
  refreshInvoiceStatus: vi.fn(),
  listReconciliableInvoices: vi.fn(async () => []),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/auth/session", () => ({ requireUser: vi.fn(async () => ({ userId: "user-1", name: "Usuario" })) }));
vi.mock("@/lib/security", () => ({ enforceSameOrigin: vi.fn(async () => undefined) }));
vi.mock("@/features/billing/emission", () => ({
  issueInvoice: mocks.issueInvoice,
  refreshInvoiceStatus: mocks.refreshInvoiceStatus,
}));
vi.mock("@/features/billing/service", () => ({ importHistoricalInvoices: vi.fn(), sendInvoiceEmail: vi.fn(), sendInvoiceIssuedEmailIfNeeded: vi.fn(async () => ({ sent: false })), sendOrderInvoiceEmailIfNeeded: vi.fn(async () => ({ sent: false })), listReconciliableInvoices: mocks.listReconciliableInvoices }));
vi.mock("@/features/integrations/intellydte", () => ({ getIntellyDteGateway: vi.fn() }));
vi.mock("@/features/audit/service", () => ({ writeAudit: vi.fn() }));

import { issueInvoiceAction, reconcilePendingInvoicesAction } from "@/features/billing/actions";

describe("billing server actions", () => {
  it("waits for SII confirmation when the emission is still enqueued", async () => {
    mocks.issueInvoice.mockResolvedValueOnce({ kind: "issued", providerDocumentId: "dte-1", folio: "22", issuedAt: "2026-08-15T12:00:00.000Z", siiStatus: "ENQUEUED" });
    const formData = new FormData();
    formData.set("orderId", "order-1");

    const result = await issueInvoiceAction({ status: "idle" }, formData);

    expect(result).toEqual({ status: "success", message: "Factura emitida; esperando confirmación del SII." });
  });

  it("reports SII acceptance only for an explicit accepted status", async () => {
    mocks.issueInvoice.mockResolvedValueOnce({ kind: "issued", providerDocumentId: "dte-2", folio: "23", issuedAt: "2026-08-15T12:00:00.000Z", siiStatus: "DOK" });
    const formData = new FormData();
    formData.set("orderId", "order-1");

    const result = await issueInvoiceAction({ status: "idle" }, formData);

    expect(result).toEqual({ status: "success", message: "Factura aceptada por el SII." });
  });

  it("reconciles pending invoices and reports the outcome", async () => {
    mocks.listReconciliableInvoices.mockResolvedValueOnce([{ id: "inv-1", folio: "22" }, { id: "inv-2", folio: "23" }]);
    mocks.refreshInvoiceStatus
      .mockResolvedValueOnce({ kind: "issued", providerDocumentId: "dte-1", folio: "22", issuedAt: "2026-08-15T12:00:00.000Z", siiStatus: "DOK" })
      .mockResolvedValueOnce({ kind: "pending", providerDocumentId: "dte-2", folio: "23", siiStatus: "ENQUEUED" });

    const result = await reconcilePendingInvoicesAction({ status: "idle" }, new FormData());

    expect(result.status).toBe("success");
    expect(result.message).toContain("2");
  });

  it("reports a pre-folio provider failure without calling it an SII rejection", async () => {
    mocks.issueInvoice.mockResolvedValueOnce({ kind: "failed", code: "ASYNC_SII_UPLOAD_DISABLED", safeMessage: "La emisión asíncrona está deshabilitada.", retryable: false });
    const formData = new FormData();
    formData.set("orderId", "order-1");

    const result = await issueInvoiceAction({ status: "idle" }, formData);

    expect(result).toEqual({ status: "error", message: "La emisión asíncrona está deshabilitada." });
  });
});
