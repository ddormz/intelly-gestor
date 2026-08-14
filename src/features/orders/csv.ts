import { z } from "zod";
import { AppError } from "@/lib/errors";
import { parseCsvText, serializeCsv } from "@/lib/csv";

const headers = ["rut_cliente", "codigo", "cantidad"];
const rowSchema = z.object({ clientTaxId: z.string().trim().min(2), catalogCode: z.string().trim().min(2).max(50).transform((value) => value.toUpperCase()), quantity: z.coerce.number().int().min(1).max(999) });
export type DraftOrderCsvRow = z.infer<typeof rowSchema>;

export function parseDraftOrdersCsv(text: string): DraftOrderCsvRow[] {
  return parseCsvText(text, headers).rows.map((row) => {
    const parsed = rowSchema.safeParse({ clientTaxId: row.rut_cliente, catalogCode: row.codigo, quantity: row.cantidad });
    if (!parsed.success) throw new AppError("CSV_ROW_INVALID", `Fila ${row.__row}: ${parsed.error.issues[0]?.message ?? "datos inválidos"}`);
    return parsed.data;
  });
}

export function draftOrdersTemplate(): string {
  return serializeCsv(headers, [["76.123.456-0", "SERV-001", "1"]]);
}

export function serializeOrdersCsv(items: Array<{ number: string; clientName: string; status: string; total: string; createdAt: Date }>): string {
  return serializeCsv(["numero", "cliente", "estado", "total_clp", "fecha_creacion"], items.map((item) => [item.number, item.clientName, item.status, item.total, item.createdAt.toISOString()]));
}
