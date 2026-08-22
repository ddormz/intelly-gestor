"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth/session";
import { getIntellyDteGateway } from "@/features/integrations/intellydte";
import { writeAudit } from "@/features/audit/service";
import { AppError, safeError } from "@/lib/errors";
import { enforceSameOrigin } from "@/lib/security";
import { formObject } from "@/lib/validation";
import { readCsvFile } from "@/lib/csv";
import type { ActionState } from "@/lib/action-state";
import { parseHistoricalInvoicesCsv } from "./csv";
import { issueInvoice, refreshInvoiceStatus } from "./emission";
import { importHistoricalInvoices, sendInvoiceEmail } from "./service";

export async function issueInvoiceAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await enforceSameOrigin();
    const user = await requireUser();
    const result = await issueInvoice(String(formData.get("orderId")), user.userId);
    revalidatePath("/facturacion"); revalidatePath("/");
    return { status: "success", message: result.kind === "issued" ? "Factura aceptada por el SII." : "Solicitud de facturación registrada." };
  } catch (error) {
    if (error instanceof AppError) return { status: "error", message: error.message };
    return { status: "error", message: safeError(error).message };
  }
}

export async function importHistoricalInvoicesAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await enforceSameOrigin();
    const user = await requireUser("admin");
    const rows = parseHistoricalInvoicesCsv(await readCsvFile(formData.get("file")));
    const count = await importHistoricalInvoices(rows, user.userId);
    revalidatePath("/facturacion"); revalidatePath("/ordenes"); revalidatePath("/");
    return { status: "success", message: `${count} facturas históricas importadas por ${user.name}.` };
  } catch (error) {
    return { status: "error", message: safeError(error).message };
  }
}

export async function refreshInvoiceStatusAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await enforceSameOrigin();
    const user = await requireUser();
    const result = await refreshInvoiceStatus(String(formData.get("invoiceId")), user.userId);
    revalidatePath("/facturacion");
    return { status: "success", message: result.kind === "issued" ? "Estado conciliado: factura emitida." : "Estado consultado; la factura sigue pendiente." };
  } catch (error) {
    return { status: "error", message: safeError(error).message };
  }
}

const foliosRequestSchema = z.object({
  tipoDte: z.coerce.number().int().refine((val) => [33, 39, 61].includes(val), "Tipo de DTE inválido (33: Factura, 39: Boleta, 61: Nota de Crédito)."),
  cantidad: z.coerce.number().int().min(1, "La cantidad debe ser al menos 1.").max(10000, "Máximo 10.000 folios por solicitud."),
});

export async function requestFoliosAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await enforceSameOrigin();
    const user = await requireUser("admin");
    const parsed = foliosRequestSchema.safeParse(formObject(formData));
    if (!parsed.success) {
      return { status: "error", message: "Revisa los campos de la solicitud.", fieldErrors: parsed.error.flatten().fieldErrors };
    }

    const gateway = await getIntellyDteGateway();
    const result = await gateway.requestFolios(parsed.data);

    await writeAudit({
      actorUserId: user.userId,
      actorType: "user",
      action: "folios.requested",
      entityType: "integration",
      entityId: `dte-${parsed.data.tipoDte}`,
      metadata: { tipoDte: parsed.data.tipoDte, cantidad: parsed.data.cantidad, cantidadOtorgada: result.cantidadOtorgada },
    });

    revalidatePath("/facturacion");
    return {
      status: "success",
      message: result.message || `Se solicitaron ${result.cantidadOtorgada} folios al SII exitosamente.`,
    };
  } catch (error) {
    return { status: "error", message: safeError(error).message };
  }
}

export async function sendInvoiceEmailAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await enforceSameOrigin();
    const user = await requireUser();
    const invoiceId = String(formData.get("invoiceId") ?? "");
    const emailOption = String(formData.get("emailOption") ?? "registered");
    const customEmail = emailOption === "custom" ? String(formData.get("customEmail") ?? "") : undefined;

    const result = await sendInvoiceEmail(invoiceId, user.userId, customEmail);
    revalidatePath("/facturacion");
    return {
      status: "success",
      message: `Factura F${result.folio} enviada por correo a ${result.recipient}.`,
    };
  } catch (error) {
    return { status: "error", message: safeError(error).message };
  }
}

export async function syncFoliosAction(_: ActionState, _formData: FormData): Promise<ActionState> {
  try {
    await enforceSameOrigin();
    await requireUser();
    const gateway = await getIntellyDteGateway();
    const folios = await gateway.getFoliosStatus();
    revalidatePath("/facturacion");
    const summary = folios.map((f) => `DTE ${f.tipoDte}: ${f.disponibles} disp.`).join(" | ");
    return {
      status: "success",
      message: `Folios sincronizados con IntellyDTE (${summary}).`,
    };
  } catch (error) {
    return { status: "error", message: safeError(error).message };
  }
}
