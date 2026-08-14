import { z } from "zod";
import { parseCsvText, serializeCsv } from "@/lib/csv";
import { clientSchema } from "./validation";
import { AppError } from "@/lib/errors";

export const clientCsvHeaders = ["tipo", "rut", "nombre", "correo", "telefono", "direccion", "comuna", "ciudad", "estado"];

const rowSchema = clientSchema.extend({ status: z.enum(["active", "inactive"]) });
export type ClientCsvRow = z.infer<typeof rowSchema>;

export function normalizeRutKey(value: string): string {
  return value.replace(/[^0-9kK]/g, "").toUpperCase();
}

export function parseClientCsv(text: string): ClientCsvRow[] {
  return parseCsvText(text, clientCsvHeaders).rows.map((row) => {
    const parsed = rowSchema.safeParse({
      kind: row.tipo.toLowerCase() === "persona" ? "person" : row.tipo.toLowerCase() === "empresa" ? "company" : row.tipo,
      taxId: row.rut,
      legalName: row.nombre,
      email: row.correo,
      phone: row.telefono,
      addressLine: row.direccion,
      commune: row.comuna,
      city: row.ciudad,
      status: row.estado.toLowerCase() === "activo" ? "active" : row.estado.toLowerCase() === "inactivo" ? "inactive" : row.estado,
    });
    if (!parsed.success) throw new AppError("CSV_ROW_INVALID", `Fila ${row.__row}: ${parsed.error.issues[0]?.message ?? "datos inválidos"}`);
    return parsed.data;
  });
}

export function serializeClientsCsv(items: Array<{ kind: "person" | "company"; taxId: string | null; legalName: string; email: string; phone: string | null; addressLine: string | null; commune: string | null; city: string | null; status: "active" | "inactive" }>): string {
  return serializeCsv(clientCsvHeaders, items.map((item) => [item.kind === "company" ? "empresa" : "persona", item.taxId, item.legalName, item.email, item.phone, item.addressLine, item.commune, item.city, item.status === "active" ? "activo" : "inactivo"]));
}

export function clientCsvTemplate(): string {
  return serializeCsv(clientCsvHeaders, [["empresa", "76.123.456-0", "Comercial Intelly SpA", "facturacion@empresa.cl", "+56 9 1234 5678", "Av. Providencia 1234", "Providencia", "Santiago", "activo"]]);
}
