"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authenticate } from "@/features/auth/service";
import { createSession, revokeCurrentSession } from "@/features/auth/session";
import { writeAudit } from "@/features/audit/service";
import { safeError } from "@/lib/errors";
import { enforceSameOrigin } from "@/lib/security";
import { formObject, parseInput } from "@/lib/validation";

export type LoginState = { error?: string };

const loginSchema = z.object({
  email: z.string().trim().email("Ingresa un correo válido.").max(254),
  password: z.string().min(1, "Ingresa tu contraseña.").max(128),
});

export async function loginAction(_: LoginState, formData: FormData): Promise<LoginState> {
  try {
    await enforceSameOrigin();
    const input = parseInput(loginSchema, formObject(formData));
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const user = await authenticate(input.email, input.password, ip);
    await createSession(user.id);
    await writeAudit({ actorUserId: user.id, actorType: "user", action: "auth.login", entityType: "user", entityId: user.id });
  } catch (error) {
    const safe = safeError(error);
    return { error: safe.message };
  }
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await enforceSameOrigin();
  await revokeCurrentSession();
  redirect("/login");
}
