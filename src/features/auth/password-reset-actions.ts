"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { requireUser } from "./session";
import { consumePasswordReset, requestPasswordReset } from "./password-reset";
import { writeAudit } from "@/features/audit/service";
import { enforceSameOrigin } from "@/lib/security";
import { safeError } from "@/lib/errors";
import type { ActionState } from "@/lib/action-state";

const emailSchema = z.string().trim().email("Ingresa un correo válido.").max(254).transform((value) => value.toLowerCase());
const resetSchema = z.object({ token: z.string().min(20), password: z.string().min(12, "Usa al menos 12 caracteres.").max(128), confirmation: z.string() }).refine((input) => input.password === input.confirmation, { path: ["confirmation"], message: "Las contraseñas no coinciden." });

async function requestIp(): Promise<string> {
  const values = await headers();
  return values.get("x-forwarded-for")?.split(",")[0]?.trim() || values.get("x-real-ip") || "unknown";
}

export async function requestPasswordResetAction(_: ActionState, formData: FormData): Promise<ActionState> {
  await enforceSameOrigin();
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { status: "error", message: "Revisa el correo indicado.", fieldErrors: { email: parsed.error.issues.map((issue) => issue.message) } };
  try {
    await requestPasswordReset(parsed.data, await requestIp());
    return { status: "success", message: "Si el correo corresponde a una cuenta activa, recibirás un enlace de recuperación." };
  } catch (error) { return { status: "error", message: safeError(error).message }; }
}

export async function sendUserRecoveryAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await enforceSameOrigin(); const admin = await requireUser("admin");
    const parsed = emailSchema.safeParse(formData.get("email"));
    if (!parsed.success) return { status: "error", message: "Correo inválido." };
    await requestPasswordReset(parsed.data, await requestIp());
    await writeAudit({ actorUserId: admin.userId, actorType: "user", action: "password_reset.requested_by_admin", entityType: "user", metadata: { requested: true } });
    return { status: "success", message: "Solicitud de recuperación procesada." };
  } catch (error) { return { status: "error", message: safeError(error).message }; }
}

export async function resetPasswordAction(_: ActionState, formData: FormData): Promise<ActionState> {
  await enforceSameOrigin();
  const parsed = resetSchema.safeParse({ token: formData.get("token"), password: formData.get("password"), confirmation: formData.get("confirmation") });
  if (!parsed.success) return { status: "error", message: "Revisa las contraseñas indicadas.", fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    const userId = await consumePasswordReset(parsed.data.token, parsed.data.password);
    await writeAudit({ actorType: "public", action: "password_reset.completed", entityType: "user", entityId: userId });
    return { status: "success", message: "Tu contraseña fue actualizada. Ya puedes iniciar sesión." };
  } catch (error) { return { status: "error", message: safeError(error).message }; }
}
