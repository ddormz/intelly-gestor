import nodemailer from "nodemailer";
import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { passwordResetEmail } from "./password-reset-email";

export async function sendPasswordResetEmail(input: { to: string; name: string; resetUrl: string; expiresMinutes: number }): Promise<void> {
  const env = getEnv();
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD || !env.SMTP_FROM) throw new AppError("SMTP_NOT_CONFIGURED", "El correo de recuperación no está configurado.");
  const transport = nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_PORT === 465, requireTLS: env.SMTP_PORT === 587, auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } });
  await transport.sendMail({ from: env.SMTP_FROM, to: input.to, ...passwordResetEmail(input) });
}
