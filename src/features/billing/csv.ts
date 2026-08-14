import { z } from "zod";
import { AppError } from "@/lib/errors";
import { parseCsvText, serializeCsv } from "@/lib/csv";

const headers = ["numero_orden", "folio", "id_externo", "fecha_emision"];
const rowSchema = z.object({ orderNumber: z.string().trim().min(3).max(32), folio: z.string().trim().min(1).max(60), providerDocumentId: z.string().trim().min(1).max(120), issuedAt: z.string().datetime({ offset: true }).transform((value) => new Date(value)) });
export type HistoricalInvoiceCsvRow = z.infer<typeof rowSchema>;

export function parseHistoricalInvoicesCsv(text: string): HistoricalInvoiceCsvRow[] {
  return parseCsvText(text, headers).rows.map((row) => {
    const parsed = rowSchema.safeParse({ orderNumber: row.numero_orden, folio: row.folio, providerDocumentId: row.id_externo, issuedAt: row.fecha_emision });
    if (!parsed.success) throw new AppError("CSV_ROW_INVALID", `Fila ${row.__row}: ${parsed.error.issues[0]?.message ?? "datos inválidos"}`);
    return parsed.data;
  });
}

export function historicalInvoicesTemplate(): string {
  return serializeCsv(headers, [["OP-20260814-ABC123", "1001", "DTE-1001", "2026-08-14T12:00:00.000Z"]]);
}

export function serializeInvoicesCsv(items: Array<{ orderNumber: string; clientName: string; status: string; folio: string | null; total: string; createdAt: Date }>): string {
  return serializeCsv(["numero_orden", "cliente", "estado", "folio", "total_clp", "fecha_registro"], items.map((item) => [item.orderNumber, item.clientName, item.status, item.folio, item.total, item.createdAt.toISOString()]));
}
