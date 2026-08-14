"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { clients } from "@/db/schema";
import { getDb } from "@/db";
import { requireUser } from "@/features/auth/session";
import { writeAudit } from "@/features/audit/service";
import { clientSchema, clientStatusSchema, clientUpdateSchema } from "./validation";
import { enforceSameOrigin } from "@/lib/security";
import { formObject } from "@/lib/validation";
import { safeError } from "@/lib/errors";
import type { ActionState } from "@/lib/action-state";

function validationError(error: { flatten(): { fieldErrors: Record<string, string[]> } }): ActionState {
  return { status: "error", message: "Revisa los campos indicados.", fieldErrors: error.flatten().fieldErrors };
}

function failure(error: unknown): ActionState {
  return { status: "error", message: safeError(error).message };
}

export async function createClientAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await enforceSameOrigin();
    const user = await requireUser();
    const parsed = clientSchema.safeParse(formObject(formData));
    if (!parsed.success) return validationError(parsed.error);
    const id = randomUUID();
    await getDb().insert(clients).values({ id, ...parsed.data, countryCode: "CL" });
    await writeAudit({ actorUserId: user.userId, actorType: "user", action: "client.created", entityType: "client", entityId: id });
    revalidatePath("/clientes");
    return { status: "success", message: "Cliente creado." };
  } catch (error) { return failure(error); }
}

export async function updateClientAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await enforceSameOrigin();
    const user = await requireUser();
    const parsed = clientUpdateSchema.safeParse(formObject(formData));
    if (!parsed.success) return validationError(parsed.error);
    const { id, ...changes } = parsed.data;
    await getDb().update(clients).set({ ...changes, updatedAt: new Date() }).where(eq(clients.id, id));
    await writeAudit({ actorUserId: user.userId, actorType: "user", action: "client.updated", entityType: "client", entityId: id });
    revalidatePath("/clientes"); revalidatePath("/ordenes");
    return { status: "success", message: "Cliente actualizado." };
  } catch (error) { return failure(error); }
}

export async function setClientStatusAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await enforceSameOrigin();
    const user = await requireUser();
    const parsed = clientStatusSchema.safeParse(formObject(formData));
    if (!parsed.success) return validationError(parsed.error);
    await getDb().update(clients).set({ status: parsed.data.status, updatedAt: new Date() }).where(eq(clients.id, parsed.data.id));
    await writeAudit({ actorUserId: user.userId, actorType: "user", action: `client.${parsed.data.status}`, entityType: "client", entityId: parsed.data.id });
    revalidatePath("/clientes"); revalidatePath("/ordenes");
    return { status: "success", message: parsed.data.status === "active" ? "Cliente activado." : "Cliente desactivado." };
  } catch (error) { return failure(error); }
}
