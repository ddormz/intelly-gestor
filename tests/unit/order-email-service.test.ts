import { describe, expect, it, vi } from "vitest";
import { getDb } from "@/db";
import { sendOrderEmail } from "@/features/orders/email-service";
import { findOrderPdf } from "@/features/orders/pdf-service";
import { createOrderPdfBytes } from "@/features/orders/pdf";
import { sendOrderMessage } from "@/features/email/mailer";

vi.mock("@/db", () => ({ getDb: vi.fn() }));
vi.mock("@/features/orders/pdf-service", () => ({ findOrderPdf: vi.fn() }));
vi.mock("@/features/orders/pdf", () => ({ createOrderPdfBytes: vi.fn() }));
vi.mock("@/features/email/mailer", () => ({ sendOrderMessage: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/features/orders/public-token", () => ({ decryptPublicToken: vi.fn(() => "current-token"), encryptPublicToken: vi.fn(() => ({ ciphertext: "cipher", iv: "iv", authTag: "tag" })) }));
vi.mock("@/lib/env", () => ({ getEnv: vi.fn(() => ({ APP_URL: "https://app.example" })) }));

function configureDb(order: Record<string, unknown>, updateAffectedRows = 1) {
  const inserts: unknown[] = [];
  const updates: unknown[] = [];
  let pending = false;
  let stateOrder = { ...order };
  const db = {
    select: vi.fn((fields: unknown) => {
      const result = Object.prototype.hasOwnProperty.call(fields as object, "clientEmail") || Object.prototype.hasOwnProperty.call(fields as object, "version") ? [stateOrder] : pending ? [{ id: "pending-id" }] : [];
      const builder = { from: () => builder, innerJoin: () => builder, where: () => builder, orderBy: () => builder, limit: () => builder, for: () => builder, execute: () => Promise.resolve(result) };
      return builder;
    }),
    update: vi.fn(() => ({ set: (value: unknown) => { updates.push(value); if (Object.prototype.hasOwnProperty.call(value as object, "version")) stateOrder = { ...stateOrder, ...value as Record<string, unknown> }; return { where: () => ({ execute: () => Promise.resolve([{ affectedRows: updateAffectedRows }]) }) }; } })),
    insert: vi.fn(() => ({ values: vi.fn((value: unknown) => { inserts.push(value); if ((value as { status?: string }).status === "pending") pending = true; return Promise.resolve(); }) })),
    transaction: vi.fn((callback: (value: typeof db) => unknown) => callback(db)),
  };
  vi.mocked(getDb).mockReturnValue(db as never);
  vi.mocked(findOrderPdf).mockResolvedValue({ id: "order-id" } as never);
  vi.mocked(createOrderPdfBytes).mockResolvedValue(new Uint8Array([1, 2, 3]));
  vi.mocked(sendOrderMessage).mockReset();
  vi.mocked(sendOrderMessage).mockResolvedValue(undefined);
  return { inserts, updates };
}

describe("sendOrderEmail", () => {
  it("audits the destination and successful delivery without changing status", async () => {
    const { inserts, updates } = configureDb({ id: "order-id", number: "OP-1", status: "issued", version: 4, publicTokenHash: "old-hash", publicTokenCiphertext: "cipher", publicTokenIv: "iv", publicTokenAuthTag: "tag", clientEmail: "cliente@example.com", clientName: "Cliente" });
    vi.mocked(sendOrderMessage).mockImplementationOnce(async () => { expect(updates[0]).toMatchObject({ version: 5 }); });
    const result = await sendOrderEmail("order-id", "user-id");
    expect(inserts[0]).toMatchObject({ paymentOrderId: "order-id", recipient: "cliente@example.com", status: "pending", createdBy: "user-id" });
    expect(updates[1]).toMatchObject({ status: "sent" });
    expect(result.publicLink).toBe("/orden/current-token");
    expect(sendOrderMessage).toHaveBeenCalledWith(expect.objectContaining({ publicUrl: "https://app.example/orden/current-token" }));
    expect(updates[0]).not.toHaveProperty("publicTokenHash");
  });

  it("rejects a missing recipient and records a failed outcome", async () => {
    const { inserts, updates } = configureDb({ id: "order-id", number: "OP-1", status: "issued", version: 4, publicTokenHash: "old-hash", publicTokenCiphertext: "cipher", publicTokenIv: "iv", publicTokenAuthTag: "tag", clientEmail: "", clientName: "Cliente" });
    await expect(sendOrderEmail("order-id", "user-id")).rejects.toMatchObject({ code: "ORDER_EMAIL_INVALID" });
    expect(inserts[0]).toMatchObject({ paymentOrderId: "order-id", status: "failed", errorCode: "ORDER_EMAIL_INVALID" });
    expect(updates).toEqual([]);
  });

  it("preserves the current token when PDF or SMTP delivery fails", async () => {
    const pdfContext = configureDb({ id: "order-id", number: "OP-1", status: "issued", version: 4, publicTokenHash: "old-hash", publicTokenCiphertext: "cipher", publicTokenIv: "iv", publicTokenAuthTag: "tag", clientEmail: "cliente@example.com", clientName: "Cliente" });
    vi.mocked(createOrderPdfBytes).mockRejectedValueOnce(new Error("pdf failed"));
    await expect(sendOrderEmail("order-id", "user-id")).rejects.toThrow("pdf failed");
    expect(pdfContext.updates).toEqual([]);
    expect(pdfContext.inserts[0]).toMatchObject({ status: "failed" });

    const smtpContext = configureDb({ id: "order-id", number: "OP-1", status: "issued", version: 4, publicTokenHash: "old-hash", publicTokenCiphertext: "cipher", publicTokenIv: "iv", publicTokenAuthTag: "tag", clientEmail: "cliente@example.com", clientName: "Cliente" });
    vi.mocked(sendOrderMessage).mockRejectedValueOnce(new Error("smtp failed"));
    await expect(sendOrderEmail("order-id", "user-id")).rejects.toThrow("smtp failed");
    expect(smtpContext.updates[0]).not.toHaveProperty("publicTokenHash");
    expect(smtpContext.inserts[0]).toMatchObject({ status: "pending" });
    expect(smtpContext.updates[1]).toMatchObject({ errorCode: "UNEXPECTED_ERROR" });
  });

  it("does not send when the durable version claim affects zero rows", async () => {
    const context = configureDb({ id: "order-id", number: "OP-1", status: "issued", version: 4, publicTokenHash: "old-hash", publicTokenCiphertext: "cipher", publicTokenIv: "iv", publicTokenAuthTag: "tag", clientEmail: "cliente@example.com", clientName: "Cliente" }, 0);
    await expect(sendOrderEmail("order-id", "user-id")).rejects.toMatchObject({ code: "ORDER_VERSION_CONFLICT" });
    expect(sendOrderMessage).not.toHaveBeenCalled();
    expect(context.inserts[0]).toMatchObject({ status: "failed", errorCode: "ORDER_VERSION_CONFLICT" });
  });
});
