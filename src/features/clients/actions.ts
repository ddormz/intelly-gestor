"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auditEvents, clients } from "@/db/schema";
import { getDb } from "@/db";
import { requireUser } from "@/features/auth/session";
import { buildAuditEvent, writeAudit } from "@/features/audit/service";
import { clientSchema, clientStatusSchema, clientUpdateSchema } from "./validation";
import { normalizeRutKey, parseClientCsvForImport, type LegacyClientCsvRow } from "./csv";
import { enforceSameOrigin } from "@/lib/security";
import { formObject } from "@/lib/validation";
import { AppError, safeError } from "@/lib/errors";
import type { ActionState } from "@/lib/action-state";
import { readCsvFile } from "@/lib/csv";
import { cityForCommune } from "./geography";

function validationError(error: { flatten(): { fieldErrors: Record<string, string[]> } }): ActionState {
  return { status: "error", message: "Revisa los campos indicados.", fieldErrors: error.flatten().fieldErrors };
}

function failure(error: unknown): ActionState {
  return { status: "error", message: safeError(error).message };
}

function clientValues(input: typeof clientSchema._output) {
  return { ...input, city: cityForCommune(input.region, input.commune) ?? input.city };
}

function legacyClientValues(input: LegacyClientCsvRow) {
  return {
    kind: input.kind,
    taxId: input.taxId || null,
    legalName: input.legalName,
    giro: input.giro || null,
    email: input.email,
    phone: input.phone || null,
    addressLine: input.addressLine || null,
    region: input.region || null,
    commune: input.commune || null,
    city: input.city || null,
  };
}

export async function createClientAction(_: ActionState, formData: FormData): Promise<ActionState> {
  let createdId: string | undefined;
  try {
    await enforceSameOrigin();
    const user = await requireUser();
    const parsed = clientSchema.safeParse(formObject(formData));
    if (!parsed.success) return validationError(parsed.error);
    createdId = randomUUID();
    await getDb().insert(clients).values({ id: createdId, ...clientValues(parsed.data), countryCode: "CL" });
    await writeAudit({ actorUserId: user.userId, actorType: "user", action: "client.created", entityType: "client", entityId: createdId });
    revalidatePath("/clientes");
    const returnTo = String(formData.get("returnTo") ?? "");
    if (returnTo.startsWith("/") && !returnTo.startsWith("//")) {
      redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}clientId=${encodeURIComponent(createdId)}`);
    }
    return {
      status: "success",
      message: "Cliente creado.",
      data: {
        id: createdId,
        legalName: parsed.data.legalName,
        taxId: parsed.data.taxId ?? null,
        email: parsed.data.email,
      },
    };
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    return failure(error);
  }
}

export async function updateClientAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await enforceSameOrigin();
    const user = await requireUser();
    const parsed = clientUpdateSchema.safeParse(formObject(formData));
    if (!parsed.success) return validationError(parsed.error);
    const { id, ...changes } = parsed.data;
    await getDb().update(clients).set({ ...clientValues(changes), updatedAt: new Date() }).where(eq(clients.id, id));
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
    const rows = parseClientCsvForImport(await readCsvFile(formData.get("file")));
    const existing = await getDb().select({ id: clients.id, taxId: clients.taxId, email: clients.email, status: clients.status }).from(clients);
    const byRut = new Map(existing.filter((item) => item.taxId).map((item) => [normalizeRutKey(item.taxId!), item]));
    const byEmail = new Map(existing.map((item) => [item.email.toLowerCase(), item]));
    let created = 0, updated = 0;
    await getDb().transaction(async (tx) => {
      for (const row of rows) {
        const isLegacy = "legacy" in row;
        const found = (row.taxId ? byRut.get(normalizeRutKey(row.taxId)) : undefined) ?? (row.email ? byEmail.get(row.email.toLowerCase()) : undefined);
        if (isLegacy && !found) throw new AppError("CSV_NEW_CLIENT_REQUIRED", `Fila ${rows.indexOf(row) + 2}: los clientes nuevos deben completar RUT, nombre, dirección y geografía.`);
        const data = { ...(isLegacy ? legacyClientValues(row) : clientValues(row)), updatedAt: new Date() };
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
