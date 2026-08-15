"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/features/auth/session";
import { AppError, safeError } from "@/lib/errors";
import { enforceSameOrigin } from "@/lib/security";
import { readCsvFile } from "@/lib/csv";
import type { ActionState } from "@/lib/action-state";
import { parseHistoricalInvoicesCsv } from "./csv";
import { issueInvoice, refreshInvoiceStatus } from "./emission";
import { importHistoricalInvoices } from "./service";

export async function issueInvoiceAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await enforceSameOrigin();
    const user = await requireUser();
    const result = await issueInvoice(String(formData.get("orderId")), user.userId);
    revalidatePath("/facturacion"); revalidatePath("/");
    return { status: "success", message: result.kind === "issued" ? "Factura emitida y PDF fiscal reconstruido." : "Solicitud de facturación registrada." };
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
