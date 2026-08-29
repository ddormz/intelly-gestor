import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getFiscalEvidenceArtifact: vi.fn(),
  regenerateInvoicePdf: vi.fn(),
  requireUser: vi.fn(),
}));

vi.mock("@/features/auth/session", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/features/billing/evidence", () => ({ getFiscalEvidenceArtifact: mocks.getFiscalEvidenceArtifact }));
vi.mock("@/features/billing/emission", () => ({ regenerateInvoicePdf: mocks.regenerateInvoicePdf }));

import { GET } from "@/app/api/invoices/[id]/pdf/route";

describe("fiscal PDF download route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ userId: "user-1", role: "operator" });
    mocks.getFiscalEvidenceArtifact
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ bytes: new Uint8Array(Buffer.from("%PDF-direct")), folio: "42" });
    mocks.regenerateInvoicePdf.mockResolvedValue({ kind: "issued", folio: "42" });
  });

  it("rebuilds a missing PDF synchronously from stored fiscal evidence", async () => {
    const response = await GET(new Request("http://localhost/api/invoices/invoice-1/pdf"), { params: Promise.resolve({ id: "invoice-1" }) });

    expect(mocks.regenerateInvoicePdf).toHaveBeenCalledWith("invoice-1", "user-1");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array(Buffer.from("%PDF-direct")));
  });

  it("handles ENOENT when artifact is missing on disk by regenerating and returning 200", async () => {
    const enoent = Object.assign(new Error("ENOENT: no such file or directory"), { code: "ENOENT" });
    mocks.getFiscalEvidenceArtifact.mockReset();
    mocks.getFiscalEvidenceArtifact
      .mockRejectedValueOnce(enoent)
      .mockResolvedValueOnce({ bytes: new Uint8Array(Buffer.from("%PDF-recovered")), folio: 123 });

    const response = await GET(new Request("http://localhost/api/invoices/invoice-2/pdf"), { params: Promise.resolve({ id: "invoice-2" }) });

    expect(mocks.regenerateInvoicePdf).toHaveBeenCalledWith("invoice-2", "user-1");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("factura-123.pdf");
  });

  it("returns 404 when invoice is not found during regeneration without throwing 500", async () => {
    const { AppError } = await import("@/lib/errors");
    mocks.getFiscalEvidenceArtifact.mockReset();
    mocks.getFiscalEvidenceArtifact.mockResolvedValueOnce(null);
    mocks.regenerateInvoicePdf.mockRejectedValueOnce(new AppError("INVOICE_NOT_FOUND", "Factura no encontrada.", 404));

    const response = await GET(new Request("http://localhost/api/invoices/unknown/pdf"), { params: Promise.resolve({ id: "unknown" }) });

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Factura no encontrada.");
  });
});
