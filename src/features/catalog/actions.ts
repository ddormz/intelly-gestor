"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { catalogItems } from "@/db/schema";
import { writeAudit } from "@/features/audit/service";
import { requireUser } from "@/features/auth/session";
import { enforceSameOrigin } from "@/lib/security";
import { formObject } from "@/lib/validation";
import { safeError } from "@/lib/errors";
import type { ActionState } from "@/lib/action-state";
import { catalogItemSchema, catalogItemStatusSchema, catalogItemUpdateSchema } from "./validation";

function validationError(error: { flatten(): { fieldErrors: Record<string, string[]> } }): ActionState {
  return { status: "error", message: "Revisa los campos indicados.", fieldErrors: error.flatten().fieldErrors };
}

function failure(error: unknown): ActionState {
  return { status: "error", message: safeError(error).message };
}

function values(input: typeof catalogItemSchema._output) {
  return { type: input.type, code: input.code, name: input.name, description: input.description, unitPrice: String(input.unitPrice), currency: "CLP", taxCategory: input.taxCategory, taxRate: input.taxCategory === "taxable" ? "19.00" : "0.00" } as const;
}

export async function createCatalogItemAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await enforceSameOrigin(); const user = await requireUser();
    const parsed = catalogItemSchema.safeParse(formObject(formData));
    if (!parsed.success) return validationError(parsed.error);
    const id = randomUUID();
    await getDb().insert(catalogItems).values({ id, ...values(parsed.data) });
    await writeAudit({ actorUserId: user.userId, actorType: "user", action: "catalog.created", entityType: "catalog_item", entityId: id });
    revalidatePath("/productos-servicios");
    return { status: "success", message: "Concepto creado." };
  } catch (error) { return failure(error); }
}

export async function updateCatalogItemAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await enforceSameOrigin(); const user = await requireUser();
    const parsed = catalogItemUpdateSchema.safeParse(formObject(formData));
    if (!parsed.success) return validationError(parsed.error);
    const { id, ...input } = parsed.data;
    await getDb().update(catalogItems).set({ ...values(input), updatedAt: new Date() }).where(eq(catalogItems.id, id));
    await writeAudit({ actorUserId: user.userId, actorType: "user", action: "catalog.updated", entityType: "catalog_item", entityId: id });
    revalidatePath("/productos-servicios"); revalidatePath("/ordenes");
    return { status: "success", message: "Concepto actualizado." };
  } catch (error) { return failure(error); }
}

export async function setCatalogItemStatusAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await enforceSameOrigin(); const user = await requireUser();
    const parsed = catalogItemStatusSchema.safeParse(formObject(formData));
    if (!parsed.success) return validationError(parsed.error);
    await getDb().update(catalogItems).set({ status: parsed.data.status, updatedAt: new Date() }).where(eq(catalogItems.id, parsed.data.id));
    await writeAudit({ actorUserId: user.userId, actorType: "user", action: `catalog.${parsed.data.status}`, entityType: "catalog_item", entityId: parsed.data.id });
    revalidatePath("/productos-servicios"); revalidatePath("/ordenes");
    return { status: "success", message: parsed.data.status === "active" ? "Concepto activado." : "Concepto desactivado." };
  } catch (error) { return failure(error); }
}
