"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth/session";
import { writeAudit } from "@/features/audit/service";
import { enforceSameOrigin } from "@/lib/security";
import { formObject, parseInput } from "@/lib/validation";
import { createOrder, issueOrder, markOrderPaid } from "./service";

const createSchema = z.object({ clientId: z.string().uuid(), catalogItemId: z.string().uuid(), quantity: z.coerce.number().int().min(1).max(999) });

export async function createOrderAction(formData: FormData): Promise<void> {
  await enforceSameOrigin(); const user = await requireUser();
  const input = parseInput(createSchema, formObject(formData));
  const id = await createOrder({ ...input, userId: user.userId });
  await writeAudit({ actorUserId: user.userId, actorType: "user", action: "order.created", entityType: "payment_order", entityId: id });
  revalidatePath("/ordenes");
}

export async function issueOrderAction(formData: FormData): Promise<void> {
  await enforceSameOrigin(); const user = await requireUser(); const id = String(formData.get("id"));
  const token = await issueOrder(id, user.userId);
  await writeAudit({ actorUserId: user.userId, actorType: "user", action: "order.issued", entityType: "payment_order", entityId: id });
  redirect(`/ordenes?publicLink=${encodeURIComponent(`/orden/${token}`)}`);
}

export async function markPaidAction(formData: FormData): Promise<void> {
  await enforceSameOrigin(); const user = await requireUser(); const id = String(formData.get("id"));
  await markOrderPaid(id, user.userId, String(formData.get("idempotencyKey") || randomUUID()));
  await writeAudit({ actorUserId: user.userId, actorType: "user", action: "order.paid", entityType: "payment_order", entityId: id });
  revalidatePath("/ordenes");
}
