"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { sessions, users } from "@/db/schema";
import { requireUser } from "@/features/auth/session";
import { hashPassword } from "@/features/auth/password";
import { enforceSameOrigin } from "@/lib/security";
import { formObject, parseInput } from "@/lib/validation";

const createSchema = z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().email().transform((value) => value.toLowerCase()), password: z.string().min(12).max(128), role: z.enum(["admin", "operator"]) });

export async function createUserAction(formData: FormData): Promise<void> {
  await enforceSameOrigin(); await requireUser("admin");
  const input = parseInput(createSchema, formObject(formData));
  await getDb().insert(users).values({ id: randomUUID(), name: input.name, email: input.email, passwordHash: await hashPassword(input.password), role: input.role, status: "active" });
  revalidatePath("/integraciones/usuarios");
}

export async function disableUserAction(formData: FormData): Promise<void> {
  await enforceSameOrigin(); const current = await requireUser("admin"); const id = String(formData.get("id"));
  if (id === current.userId) throw new Error("No puedes desactivar tu propia cuenta activa.");
  await getDb().transaction(async (tx) => { await tx.update(users).set({ status: "disabled" }).where(eq(users.id, id)); await tx.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.userId, id)); });
  revalidatePath("/integraciones/usuarios");
}
