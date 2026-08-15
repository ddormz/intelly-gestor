"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth/session";
import { enforceSameOrigin } from "@/lib/security";
import { formObject } from "@/lib/validation";
import { safeError } from "@/lib/errors";
import { readCsvFile } from "@/lib/csv";
import type { ActionState } from "@/lib/action-state";
import { parseDraftOrdersCsv } from "./csv";
import { createOrder, createOrderFromCart, importDraftOrders, issueOrder, markOrderPaid, updateOrderFromCart } from "./service";
import { sendOrderEmail } from "./email-service";
import { searchActiveCatalog, searchActiveClients } from "./search";
import { orderCartSchema } from "./validation";

const createSchema = z.object({ clientId: z.string().uuid(), catalogItemId: z.string().uuid(), quantity: z.coerce.number().int().min(1).max(999) });
const failure = (error: unknown): ActionState => ({ status: "error", message: safeError(error).message });

function parseCartForm(formData: FormData) {
  const values = formObject(formData);
  let lines: unknown;
  try {
    lines = JSON.parse(values.cart ?? "[]");
  } catch {
    return { success: false as const, error: { flatten: () => ({ fieldErrors: { cart: ["El carrito no es válido."] } }) } };
  }
  return orderCartSchema.safeParse({ ...values, lines });
}

export async function createOrderAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await enforceSameOrigin(); const user = await requireUser();
    const parsed = createSchema.safeParse(formObject(formData));
    if (!parsed.success) return { status: "error", message: "Revisa los campos indicados.", fieldErrors: parsed.error.flatten().fieldErrors };
     await createOrder({ ...parsed.data, userId: user.userId }, user.role);
    revalidatePath("/ordenes");
    return { status: "success", message: "Borrador creado." };
  } catch (error) { return failure(error); }
}

export async function createOrderFromCartAction(_: ActionState, formData: FormData): Promise<ActionState> {
  let id: string | undefined;
  try {
    await enforceSameOrigin();
    const user = await requireUser();
    const parsed = parseCartForm(formData);
    if (!parsed.success) return { status: "error", message: "Revisa los campos indicados.", fieldErrors: parsed.error.flatten().fieldErrors };
    id = await createOrderFromCart(parsed.data, user.userId, user.role);
    revalidatePath("/ordenes");
  } catch (error) { return failure(error); }
  redirect(`/ordenes/${id!}/editar`);
}

export async function updateOrderFromCartAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await enforceSameOrigin();
    const user = await requireUser();
    const id = String(formData.get("id"));
    const parsed = parseCartForm(formData);
    if (!parsed.success) return { status: "error", message: "Revisa los campos indicados.", fieldErrors: parsed.error.flatten().fieldErrors };
    const result = await updateOrderFromCart({ ...parsed.data, id }, user.userId, Number(formData.get("expectedVersion")), user.role);
    revalidatePath("/ordenes");
    revalidatePath(`/ordenes/${id}/editar`);
    return { status: "success", message: "Orden actualizada.", data: result.publicLink ? { publicLink: result.publicLink } : undefined };
  } catch (error) { return failure(error); }
}

export async function searchActiveClientsAction(query: string) {
  await enforceSameOrigin();
  await requireUser();
  return searchActiveClients(query);
}

export async function searchActiveCatalogAction(query: string) {
  await enforceSameOrigin();
  await requireUser();
  return searchActiveCatalog(query);
}

export async function issueOrderAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await enforceSameOrigin();
    const user = await requireUser();
    const id = String(formData.get("id"));
    const token = await issueOrder(id, user.userId);
    revalidatePath("/ordenes");
    return {
      status: "success",
      message: "Orden emitida correctamente.",
      data: { publicLink: `/orden/${token}` },
    };
  } catch (error) {
    return failure(error);
  }
}

export async function markPaidAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await enforceSameOrigin(); const user = await requireUser(); const id = String(formData.get("id"));
    await markOrderPaid(id, user.userId, String(formData.get("idempotencyKey") || randomUUID()));
    revalidatePath("/ordenes");
    return { status: "success", message: "Pago registrado." };
  } catch (error) { return failure(error); }
}

export async function sendOrderEmailAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await enforceSameOrigin();
    const user = await requireUser();
    const id = String(formData.get("id"));
    const result = await sendOrderEmail(id, user.userId);
    revalidatePath("/ordenes");
    return { status: "success", message: "Orden enviada por correo.", data: { publicLink: result.publicLink } };
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
