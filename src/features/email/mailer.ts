import nodemailer from "nodemailer";
import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { passwordResetEmail } from "./password-reset-email";
import { orderEmail } from "./order-email";
import { invoiceEmail } from "./invoice-email";

export type SenderAddress = { name: string; address: string } | string;

export function parseSender(fromStr?: string, defaultEmail?: string): SenderAddress {
  if (!fromStr || !fromStr.trim()) {
    return defaultEmail ? { name: "Intelly Pagos", address: defaultEmail.trim() } : "Intelly Pagos";
  }
  const clean = fromStr.trim();
  const match = clean.match(/^(?:"?([^"<]+)"?\s*)?<?([^>]+)>?$/);
  if (match && match[2] && match[2].includes("@")) {
    return {
      name: (match[1] || "Intelly Pagos").trim().replace(/^["']|["']$/g, ""),
      address: match[2].trim(),
    };
  }
  return clean;
}

export function getMailTransport() {
  const env = getEnv();
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) {
    throw new AppError("SMTP_NOT_CONFIGURED", "El servidor SMTP no está configurado.");
  }
  const port = Number(env.SMTP_PORT) || 465;
  const isSecure = port === 465;
  const user = env.SMTP_USER.trim();
  const pass = env.SMTP_PASSWORD.trim();

  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST.trim(),
    port,
    secure: isSecure,
    requireTLS: !isSecure && port === 587,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });

  const from = parseSender(env.SMTP_FROM, user);
  return { transport, from, user };
}

export async function sendPasswordResetEmail(input: {
  to: string;
  name: string;
  resetUrl: string;
  expiresMinutes: number;
}): Promise<void> {
  const { transport, from, user } = getMailTransport();
  await transport.sendMail({
    from,
    replyTo: user,
    to: input.to,
    envelope: { from: user, to: input.to },
    ...passwordResetEmail(input),
  });
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
  const { transport, from, user } = getMailTransport();
  await transport.sendMail({
    from,
    replyTo: user,
    to: input.to,
    envelope: { from: user, to: input.to },
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
  const { transport, from, user } = getMailTransport();

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
    from,
    replyTo: user,
    to: input.to,
    envelope: { from: user, to: input.to },
    ...invoiceEmail(input),
    attachments,
  });
}

export async function testSmtpConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    const { transport, from, user } = getMailTransport();
    await transport.verify();
    const env = getEnv();
    const fromLabel = typeof from === "object" && from !== null && "address" in from ? `${from.name} <${from.address}>` : String(from);
    return {
      ok: true,
      message: `Conexión SMTP exitosa con ${env.SMTP_HOST}:${env.SMTP_PORT} (${fromLabel || user})`,
    };
  } catch (error) {
    return {
      ok: false,
      message: `Error al conectar con servidor SMTP: ${error instanceof Error ? error.message : "Fallo de handshake"}`,
    };
  }
}
