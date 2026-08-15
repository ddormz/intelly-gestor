import { describe, expect, it, vi } from "vitest";
import { sendOrderMessage } from "@/features/email/mailer";
import { orderEmail } from "@/features/email/order-email";
import { createOrderPdfBytes } from "@/features/orders/pdf";

const transport = { sendMail: vi.fn().mockResolvedValue({ messageId: "message-1" }) };

vi.mock("nodemailer", () => ({ default: { createTransport: vi.fn(() => transport) } }));
vi.mock("@/lib/env", () => ({ getEnv: vi.fn(() => ({ SMTP_HOST: "smtp.example", SMTP_PORT: 465, SMTP_USER: "user", SMTP_PASSWORD: "password", SMTP_FROM: "Gestor <gestor@example.com>" })) }));

describe("order email delivery", () => {
  it("builds a Spanish message with the secure link and commercial PDF attachment", () => {
    const message = orderEmail({ name: "Cliente", number: "OP-1", publicUrl: "https://app.example/orden/token" });
    expect(message.subject).toContain("orden de pago");
    expect(message.text).toContain("https://app.example/orden/token");
    expect(message.html).toContain("Cliente");
  });

  it("sends the recipient, public link, and PDF bytes without persisting credentials", async () => {
    transport.sendMail.mockClear();
    await sendOrderMessage({ to: "cliente@example.com", name: "Cliente", number: "OP-1", publicUrl: "https://app.example/orden/token", pdf: new Uint8Array([1, 2, 3]) });
    expect(transport.sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: "cliente@example.com",
      attachments: [expect.objectContaining({ filename: "orden-pago-OP-1.pdf", content: expect.any(Buffer), contentType: "application/pdf" })],
      text: expect.stringContaining("https://app.example/orden/token"),
    }));
    expect(JSON.stringify(transport.sendMail.mock.calls[0]?.[0])).not.toContain("password");
  });

  it("fails in Spanish when SMTP is not configured", async () => {
    const { getEnv } = await import("@/lib/env");
    vi.mocked(getEnv).mockReturnValue({ SMTP_HOST: "", SMTP_PORT: 465, SMTP_USER: "", SMTP_PASSWORD: "", SMTP_FROM: "" } as never);
    await expect(sendOrderMessage({ to: "cliente@example.com", name: "Cliente", number: "OP-1", publicUrl: "https://app.example/orden/token", pdf: new Uint8Array([1]) })).rejects.toMatchObject({ code: "SMTP_NOT_CONFIGURED" });
  });

  it("exposes commercial PDF bytes for non-HTTP consumers", async () => {
    const bytes = await createOrderPdfBytes({ id: "order-1", number: "OP-1", committed: false, issueDate: "2026-08-15", dueDate: "2026-08-25", customerName: "Cliente", customerRut: "76.123.456-0", customerEmail: "cliente@example.com", serviceType: "custom", invoice: true, discountPercent: 0, discountReason: "", items: [{ id: "line-1", name: "Servicio", description: "Cantidad: 1", amount: 1000 }], createdAt: "2026-08-15T00:00:00.000Z" });
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.byteLength).toBeGreaterThan(100);
  });
});
