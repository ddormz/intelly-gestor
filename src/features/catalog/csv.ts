import { z } from "zod";
import { parseCsvText, serializeCsv } from "@/lib/csv";
import { catalogItemSchema } from "./validation";
import { AppError } from "@/lib/errors";

export const catalogCsvHeaders = ["tipo", "codigo", "nombre", "descripcion", "precio_clp", "tratamiento_tributario", "estado"];
const rowSchema = catalogItemSchema.extend({ status: z.enum(["active", "inactive"]) });
export type CatalogCsvRow = z.infer<typeof rowSchema>;

export function parseCatalogCsv(text: string): CatalogCsvRow[] {
  return parseCsvText(text, catalogCsvHeaders).rows.map((row) => {
    const parsed = rowSchema.safeParse({
      type: row.tipo.toLowerCase() === "servicio" ? "service" : row.tipo.toLowerCase() === "producto" ? "product" : row.tipo,
      code: row.codigo,
      name: row.nombre,
      description: row.descripcion,
      unitPrice: row.precio_clp,
      taxCategory: row.tratamiento_tributario.toLowerCase() === "afecto" ? "taxable" : row.tratamiento_tributario.toLowerCase() === "exento" ? "exempt" : row.tratamiento_tributario,
      status: row.estado.toLowerCase() === "activo" ? "active" : row.estado.toLowerCase() === "inactivo" ? "inactive" : row.estado,
    });
    if (!parsed.success) throw new AppError("CSV_ROW_INVALID", `Fila ${row.__row}: ${parsed.error.issues[0]?.message ?? "datos inválidos"}`);
    return parsed.data;
  });
}

export function serializeCatalogCsv(items: Array<{ type: "product" | "service"; code: string; name: string; description: string | null; unitPrice: string; taxCategory: "taxable" | "exempt"; status: "active" | "inactive" }>): string {
  return serializeCsv(catalogCsvHeaders, items.map((item) => [item.type === "service" ? "servicio" : "producto", item.code, item.name, item.description, item.unitPrice, item.taxCategory === "taxable" ? "afecto" : "exento", item.status === "active" ? "activo" : "inactivo"]));
}

export function catalogCsvTemplate(): string {
  return serializeCsv(catalogCsvHeaders, [["servicio", "SERV-001", "Implementación mensual", "Servicio recurrente", "150000", "afecto", "activo"]]);
}
