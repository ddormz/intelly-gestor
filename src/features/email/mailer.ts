import nodemailer from "nodemailer";
import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { passwordResetEmail } from "./password-reset-email";
import { orderEmail } from "./order-email";

export async function sendPasswordResetEmail(input: { to: string; name: string; resetUrl: string; expiresMinutes: number }): Promise<void> {
  const env = getEnv();
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD || !env.SMTP_FROM) throw new AppError("SMTP_NOT_CONFIGURED", "El correo de recuperación no está configurado.");
  const transport = nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_PORT === 465, requireTLS: env.SMTP_PORT === 587, auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } });
  await transport.sendMail({ from: env.SMTP_FROM, to: input.to, ...passwordResetEmail(input) });
}

export async function sendOrderMessage(input: { to: string; name: string; number: string; publicUrl: string; pdf: Uint8Array }): Promise<void> {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.to)) throw new AppError("ORDER_EMAIL_INVALID", "El correo del cliente no es válido.");
  const env = getEnv();
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD || !env.SMTP_FROM) throw new AppError("SMTP_NOT_CONFIGURED", "El correo de órdenes no está configurado.");
  const transport = nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_PORT === 465, requireTLS: env.SMTP_PORT === 587, auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } });
  await transport.sendMail({
    from: env.SMTP_FROM,
    to: input.to,
    ...orderEmail(input),
    attachments: [{ filename: `orden-pago-${input.number.replace(/[^A-Za-z0-9_-]/g, "-")}.pdf`, content: Buffer.from(input.pdf), contentType: "application/pdf" }],
  });
}
