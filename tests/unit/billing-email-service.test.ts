import { describe, expect, it, vi } from "vitest";
import { getDb } from "@/db";
import { sendInvoiceEmail } from "@/features/billing/service";

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
});
