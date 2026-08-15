"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auditEvents, clients } from "@/db/schema";
import { getDb } from "@/db";
import { requireUser } from "@/features/auth/session";
import { buildAuditEvent, writeAudit } from "@/features/audit/service";
import { clientSchema, clientStatusSchema, clientUpdateSchema } from "./validation";
import { normalizeRutKey, parseClientCsv } from "./csv";
import { enforceSameOrigin } from "@/lib/security";
import { formObject } from "@/lib/validation";
import { safeError } from "@/lib/errors";
import type { ActionState } from "@/lib/action-state";
import { readCsvFile } from "@/lib/csv";

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

export async function importClientsAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await enforceSameOrigin();
    const user = await requireUser("admin");
    const rows = parseClientCsv(await readCsvFile(formData.get("file")));
    const existing = await getDb().select({ id: clients.id, taxId: clients.taxId, email: clients.email, status: clients.status }).from(clients);
    const byRut = new Map(existing.filter((item) => item.taxId).map((item) => [normalizeRutKey(item.taxId!), item]));
    const byEmail = new Map(existing.map((item) => [item.email.toLowerCase(), item]));
    let created = 0, updated = 0;
    await getDb().transaction(async (tx) => {
      for (const row of rows) {
        const found = byRut.get(normalizeRutKey(row.taxId)) ?? byEmail.get(row.email.toLowerCase());
        const data = { kind: row.kind, taxId: row.taxId, legalName: row.legalName, email: row.email, phone: row.phone, addressLine: row.addressLine, commune: row.commune, city: row.city, updatedAt: new Date() };
        if (found) {
          await tx.update(clients).set(data).where(eq(clients.id, found.id));
          updated++;
        } else {
          const id = randomUUID();
          const inserted = { id, ...data, countryCode: "CL", status: row.status } as const;
          await tx.insert(clients).values(inserted);
          const key = { id, taxId: row.taxId, email: row.email, status: row.status };
          byRut.set(normalizeRutKey(row.taxId), key); byEmail.set(row.email.toLowerCase(), key);
          created++;
        }
      }
      await tx.insert(auditEvents).values(buildAuditEvent({ actorUserId: user.userId, actorType: "user", action: "clients.imported", entityType: "client", metadata: { created, updated } }));
    });
    revalidatePath("/clientes"); revalidatePath("/ordenes");
    return { status: "success", message: `Importación completada: ${created} creados y ${updated} actualizados.` };
  } catch (error) { return failure(error); }
}
