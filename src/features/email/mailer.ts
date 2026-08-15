import nodemailer from "nodemailer";
import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { passwordResetEmail } from "./password-reset-email";
import { orderEmail } from "./order-email";
import { invoiceEmail } from "./invoice-email";

export async function sendPasswordResetEmail(input: {
  to: string;
  name: string;
  resetUrl: string;
  expiresMinutes: number;
}): Promise<void> {
  const env = getEnv();
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD || !env.SMTP_FROM) {
    throw new AppError("SMTP_NOT_CONFIGURED", "El correo de recuperación no está configurado.");
  }
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    requireTLS: env.SMTP_PORT === 587,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
  });
  await transport.sendMail({ from: env.SMTP_FROM, to: input.to, ...passwordResetEmail(input) });
}

export async function sendOrderMessage(input: {
  to: string;
  name: string;
  number: string;
  publicUrl: string;
  pdf: Uint8Array;
}): Promise<void> {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.to)) {
    throw new AppError("ORDER_EMAIL_INVALID", "El correo del cliente no es válido.");
  }
  const env = getEnv();
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD || !env.SMTP_FROM) {
    throw new AppError("SMTP_NOT_CONFIGURED", "El correo de órdenes no está configurado.");
  }
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    requireTLS: env.SMTP_PORT === 587,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
  });
  await transport.sendMail({
    from: env.SMTP_FROM,
    to: input.to,
    ...orderEmail(input),
    attachments: [
      {
        filename: `orden-pago-${input.number.replace(/[^A-Za-z0-9_-]/g, "-")}.pdf`,
        content: Buffer.from(input.pdf),
        contentType: "application/pdf",
      },
    ],
  });
}

export async function sendInvoiceMessage(input: {
  to: string;
  name: string;
  folio: number;
  pdf: Uint8Array;
  xml?: string;
}): Promise<void> {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.to)) {
    throw new AppError("INVOICE_EMAIL_INVALID", "El correo del receptor no es válido.");
  }
  const env = getEnv();
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD || !env.SMTP_FROM) {
    throw new AppError("SMTP_NOT_CONFIGURED", "El servidor SMTP no está configurado.");
  }
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    requireTLS: env.SMTP_PORT === 587,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
  });

  const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [
    {
      filename: `factura-electronica-${input.folio}.pdf`,
      content: Buffer.from(input.pdf),
      contentType: "application/pdf",
    },
  ];

  if (input.xml) {
    attachments.push({
      filename: `DTE-33-F${input.folio}.xml`,
      content: Buffer.from(input.xml, "latin1"),
      contentType: "application/xml",
    });
  }

  await transport.sendMail({
    from: env.SMTP_FROM,
    to: input.to,
    ...invoiceEmail(input),
    attachments,
  });
}

export async function testSmtpConnection(): Promise<{ ok: boolean; message: string }> {
  const env = getEnv();
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD || !env.SMTP_FROM) {
    return {
      ok: false,
      message: "El servidor SMTP no está completamente configurado en las variables de entorno.",
    };
  }
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    requireTLS: env.SMTP_PORT === 587,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
  });

  try {
    await transport.verify();
    return {
      ok: true,
      message: `Conexión SMTP exitosa con ${env.SMTP_HOST}:${env.SMTP_PORT} (${env.SMTP_FROM})`,
    };
  } catch (error) {
    return {
      ok: false,
      message: `Error al conectar con servidor SMTP: ${error instanceof Error ? error.message : "Fallo de handshake"}`,
    };
  }
}
