import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db";
import { sendInvoiceEmail, sendInvoiceIssuedEmailIfNeeded } from "@/features/billing/service";

const mocks = vi.hoisted(() => ({
  getFiscalEvidenceArtifact: vi.fn(),
  sendInvoiceMessage: vi.fn(),
  writeAudit: vi.fn(),
}));

vi.mock("@/db", () => ({ getDb: vi.fn() }));
vi.mock("@/features/billing/evidence", () => ({ getFiscalEvidenceArtifact: mocks.getFiscalEvidenceArtifact }));
vi.mock("@/features/email/mailer", () => ({ sendInvoiceMessage: mocks.sendInvoiceMessage }));
vi.mock("@/features/audit/service", () => ({ buildAuditEvent: vi.fn(), writeAudit: mocks.writeAudit }));

function builder<T>(result: T) {
  const chain = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    execute: vi.fn(async () => result),
  };
  return chain;
}

describe("invoice email service", () => {
  it("passes the original PDF and XML bytes to the mailer", async () => {
    const pdfBytes = new Uint8Array([37, 80, 68, 70]);
    const xmlBytes = new Uint8Array([60, 68, 84, 69, 62, 0xc3, 0xb3]);
    const selects = [builder([{ id: "invoice-1", paymentOrderId: "order-1", status: "issued", folio: "42", orderNumber: "OP-1", clientName: "Cliente", clientEmail: "cliente@example.com" }])];
    vi.mocked(getDb).mockReturnValue({ select: vi.fn(() => selects.shift() ?? builder([])) } as never);
    mocks.getFiscalEvidenceArtifact.mockImplementation(async (_invoiceId: string, kind: string) => ({ bytes: kind === "reconstructed_pdf" ? pdfBytes : xmlBytes }));
    mocks.sendInvoiceMessage.mockResolvedValue(undefined);

    await sendInvoiceEmail("invoice-1", "user-1", "destino@example.com");

    expect(mocks.sendInvoiceMessage).toHaveBeenCalledWith(expect.objectContaining({ pdf: pdfBytes, xml: xmlBytes }));
  });

  describe("sendInvoiceIssuedEmailIfNeeded", () => {
    const pdfBytes = new Uint8Array([37, 80, 68, 70]);

    beforeEach(() => {
      mocks.sendInvoiceMessage.mockReset().mockResolvedValue(undefined);
      mocks.writeAudit.mockReset().mockResolvedValue(undefined);
      mocks.getFiscalEvidenceArtifact.mockReset().mockImplementation(async (_invoiceId: string, kind: string) => (
        kind === "reconstructed_pdf" ? { bytes: pdfBytes } : { bytes: new Uint8Array([60]) }
      ));
    });

    function issuedInvoiceRow(overrides: Record<string, unknown> = {}) {
      return {
        id: "invoice-1",
        paymentOrderId: "order-1",
        status: "issued",
        siiStatus: "DOK",
        hasPdf: "pdf-evidence-1",
        orderCreatedBy: "creator-1",
        folio: "42",
        orderNumber: "OP-1",
        clientName: "Cliente",
        clientEmail: "cliente@example.com",
        ...overrides,
      };
    }

    it("sends once when the invoice is SII-accepted with evidence", async () => {
      const selects = [
        builder([issuedInvoiceRow()]),
        builder([]),
        builder([{ id: "user-1" }]),
        builder([issuedInvoiceRow()]),
        builder([{ recipient: "orden@example.com" }]),
      ];
      vi.mocked(getDb).mockReturnValue({ select: vi.fn(() => selects.shift() ?? builder([])) } as never);

      const outcome = await sendInvoiceIssuedEmailIfNeeded("invoice-1", "user-1");

      expect(outcome).toEqual({ sent: true, invoiceId: "invoice-1" });
      expect(mocks.sendInvoiceMessage).toHaveBeenCalledOnce();
      expect(mocks.sendInvoiceMessage).toHaveBeenCalledWith(expect.objectContaining({ to: "orden@example.com" }));
    });

    it("skips when the invoice was already emailed", async () => {
      const selects = [builder([issuedInvoiceRow()]), builder([{ id: "audit-1" }])];
      vi.mocked(getDb).mockReturnValue({ select: vi.fn(() => selects.shift() ?? builder([])) } as never);

      const outcome = await sendInvoiceIssuedEmailIfNeeded("invoice-1", "user-1");

      expect(outcome).toEqual({ sent: false, invoiceId: "invoice-1", reason: "already-sent" });
      expect(mocks.sendInvoiceMessage).not.toHaveBeenCalled();
    });

    it("skips when the invoice is not SII-accepted yet", async () => {
      const selects = [builder([issuedInvoiceRow({ status: "processing", siiStatus: "ENQUEUED" })])];
      vi.mocked(getDb).mockReturnValue({ select: vi.fn(() => selects.shift() ?? builder([])) } as never);

      const outcome = await sendInvoiceIssuedEmailIfNeeded("invoice-1", "user-1");

      expect(outcome).toEqual({ sent: false, invoiceId: "invoice-1", reason: "not-accepted" });
      expect(mocks.sendInvoiceMessage).not.toHaveBeenCalled();
    });

    it("skips when the fiscal evidence is still pending", async () => {
      const selects = [builder([issuedInvoiceRow({ hasPdf: null })])];
      vi.mocked(getDb).mockReturnValue({ select: vi.fn(() => selects.shift() ?? builder([])) } as never);

      const outcome = await sendInvoiceIssuedEmailIfNeeded("invoice-1", "user-1");

      expect(outcome).toEqual({ sent: false, invoiceId: "invoice-1", reason: "evidence-pending" });
      expect(mocks.sendInvoiceMessage).not.toHaveBeenCalled();
    });
  });
});
