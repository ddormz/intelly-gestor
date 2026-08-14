"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { sessions, users } from "@/db/schema";
import { requireUser } from "@/features/auth/session";
import { hashPassword } from "@/features/auth/password";
import { writeAudit } from "@/features/audit/service";
import { enforceSameOrigin } from "@/lib/security";
import { formObject } from "@/lib/validation";
import { AppError, safeError } from "@/lib/errors";
import { readCsvFile } from "@/lib/csv";
import type { ActionState } from "@/lib/action-state";
import { assertUserStatusChangeAllowed, userStatusSchema, userUpdateSchema } from "./admin-service";
import { parseUsersCsv } from "./users-csv";

const createSchema = z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().email().transform((value) => value.toLowerCase()), password: z.string().min(12).max(128), role: z.enum(["admin", "operator"]) });
const failure = (error: unknown): ActionState => ({ status: "error", message: safeError(error).message });

export async function createUserAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await enforceSameOrigin(); const current = await requireUser("admin");
    const parsed = createSchema.safeParse(formObject(formData));
    if (!parsed.success) return { status: "error", message: "Revisa los campos indicados.", fieldErrors: parsed.error.flatten().fieldErrors };
    const id = randomUUID();
    await getDb().insert(users).values({ id, name: parsed.data.name, email: parsed.data.email, passwordHash: await hashPassword(parsed.data.password), role: parsed.data.role, status: "active" });
    await writeAudit({ actorUserId: current.userId, actorType: "user", action: "user.created", entityType: "user", entityId: id });
    revalidatePath("/usuarios");
    return { status: "success", message: "Usuario creado." };
  } catch (error) { return failure(error); }
}

export async function updateUserAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await enforceSameOrigin(); const current = await requireUser("admin");
    const parsed = userUpdateSchema.safeParse(formObject(formData));
    if (!parsed.success) return { status: "error", message: "Revisa los campos indicados.", fieldErrors: parsed.error.flatten().fieldErrors };
    await getDb().update(users).set({ name: parsed.data.name, role: parsed.data.role, updatedAt: new Date() }).where(eq(users.id, parsed.data.id));
    await writeAudit({ actorUserId: current.userId, actorType: "user", action: "user.updated", entityType: "user", entityId: parsed.data.id });
    revalidatePath("/usuarios");
    return { status: "success", message: "Usuario actualizado." };
  } catch (error) { return failure(error); }
}

export async function setUserStatusAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await enforceSameOrigin(); const current = await requireUser("admin");
    const parsed = userStatusSchema.safeParse(formObject(formData));
    if (!parsed.success) return { status: "error", message: "Estado inválido.", fieldErrors: parsed.error.flatten().fieldErrors };
    assertUserStatusChangeAllowed(current.userId, parsed.data.id, parsed.data.status);
    await getDb().transaction(async (tx) => {
      await tx.update(users).set({ status: parsed.data.status, failedLoginCount: 0, lockedUntil: null, updatedAt: new Date() }).where(eq(users.id, parsed.data.id));
      if (parsed.data.status === "disabled") await tx.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.userId, parsed.data.id));
    });
    await writeAudit({ actorUserId: current.userId, actorType: "user", action: `user.${parsed.data.status}`, entityType: "user", entityId: parsed.data.id });
    revalidatePath("/usuarios");
    return { status: "success", message: parsed.data.status === "active" ? "Usuario activado." : "Usuario desactivado." };
  } catch (error) { return failure(error); }
}

export async function importUsersAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await enforceSameOrigin(); const current = await requireUser("admin");
    const rows = parseUsersCsv(await readCsvFile(formData.get("file")));
    const existing = await getDb().select({ id: users.id, email: users.email, status: users.status }).from(users);
    const byEmail = new Map(existing.map((item) => [item.email.toLowerCase(), item]));
    const prepared = await Promise.all(rows.map(async (row, index) => {
      const found = byEmail.get(row.email);
      if (!found && row.temporaryPassword.length < 12) throw new AppError("CSV_PASSWORD_REQUIRED", `Fila ${index + 2}: una cuenta nueva requiere contraseña temporal de al menos 12 caracteres.`);
      return { row, found, passwordHash: found ? null : await hashPassword(row.temporaryPassword) };
    }));
    let created = 0, updated = 0;
    await getDb().transaction(async (tx) => {
      for (const item of prepared) {
        if (item.found) {
          const nextStatus = item.row.status === "disabled" ? "disabled" : item.found.status;
          await tx.update(users).set({ name: item.row.name, role: item.row.role, status: nextStatus, updatedAt: new Date() }).where(eq(users.id, item.found.id));
          if (nextStatus === "disabled") await tx.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.userId, item.found.id));
          updated++;
        } else {
          const id = randomUUID();
          await tx.insert(users).values({ id, name: item.row.name, email: item.row.email, passwordHash: item.passwordHash!, role: item.row.role, status: item.row.status });
          byEmail.set(item.row.email, { id, email: item.row.email, status: item.row.status });
          created++;
        }
      }
    });
    await writeAudit({ actorUserId: current.userId, actorType: "user", action: "users.imported", entityType: "user", metadata: { created, updated } });
    revalidatePath("/usuarios");
    return { status: "success", message: `Importación completada: ${created} creados y ${updated} actualizados.` };
  } catch (error) { return failure(error); }
}
