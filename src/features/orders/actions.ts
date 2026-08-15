"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth/session";
import { writeAudit } from "@/features/audit/service";
import { enforceSameOrigin } from "@/lib/security";
import { formObject } from "@/lib/validation";
import { safeError } from "@/lib/errors";
import { readCsvFile } from "@/lib/csv";
import type { ActionState } from "@/lib/action-state";
import { parseDraftOrdersCsv } from "./csv";
import { createOrder, importDraftOrders, issueOrder, markOrderPaid } from "./service";

const createSchema = z.object({ clientId: z.string().uuid(), catalogItemId: z.string().uuid(), quantity: z.coerce.number().int().min(1).max(999) });
const failure = (error: unknown): ActionState => ({ status: "error", message: safeError(error).message });

export async function createOrderAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await enforceSameOrigin(); const user = await requireUser();
    const parsed = createSchema.safeParse(formObject(formData));
    if (!parsed.success) return { status: "error", message: "Revisa los campos indicados.", fieldErrors: parsed.error.flatten().fieldErrors };
    const id = await createOrder({ ...parsed.data, userId: user.userId });
    await writeAudit({ actorUserId: user.userId, actorType: "user", action: "order.created", entityType: "payment_order", entityId: id });
    revalidatePath("/ordenes");
    return { status: "success", message: "Borrador creado." };
  } catch (error) { return failure(error); }
}

export async function issueOrderAction(_: ActionState, formData: FormData): Promise<ActionState> {
  await enforceSameOrigin(); const user = await requireUser(); const id = String(formData.get("id"));
  const token = await issueOrder(id, user.userId);
  await writeAudit({ actorUserId: user.userId, actorType: "user", action: "order.issued", entityType: "payment_order", entityId: id });
  redirect(`/ordenes?publicLink=${encodeURIComponent(`/orden/${token}`)}`);
}

export async function markPaidAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await enforceSameOrigin(); const user = await requireUser(); const id = String(formData.get("id"));
    await markOrderPaid(id, user.userId, String(formData.get("idempotencyKey") || randomUUID()));
    await writeAudit({ actorUserId: user.userId, actorType: "user", action: "order.paid", entityType: "payment_order", entityId: id });
    revalidatePath("/ordenes");
    return { status: "success", message: "Pago registrado." };
  } catch (error) { return failure(error); }
}

export async function importDraftOrdersAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await enforceSameOrigin(); const user = await requireUser("admin");
    const rows = parseDraftOrdersCsv(await readCsvFile(formData.get("file")));
    const count = await importDraftOrders(rows, user.userId);
    revalidatePath("/ordenes"); revalidatePath("/");
    return { status: "success", message: `${count} borradores importados.` };
  } catch (error) { return failure(error); }
}
