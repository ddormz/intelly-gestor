import { z } from "zod";
import { parseCsvText, serializeCsv } from "@/lib/csv";
import { clientSchema } from "./validation";
import { AppError } from "@/lib/errors";

export const clientCsvHeaders = ["tipo", "rut", "nombre", "giro", "correo", "telefono", "direccion", "region", "comuna", "ciudad", "estado"];

const rowSchema = clientSchema.extend({ status: z.enum(["active", "inactive"]) });
export type ClientCsvRow = z.infer<typeof rowSchema>;
const legacyRowSchema = z.object({
  kind: z.enum(["person", "company"]),
  taxId: z.string().trim(),
  legalName: z.string().trim(),
  giro: z.string().trim(),
  email: z.string().trim(),
  phone: z.string().trim(),
  addressLine: z.string().trim(),
  region: z.string().trim(),
  commune: z.string().trim(),
  city: z.string().trim(),
  status: z.enum(["active", "inactive"]),
});
export type LegacyClientCsvRow = z.infer<typeof legacyRowSchema> & { legacy: true };

export function normalizeRutKey(value: string): string {
  return value.replace(/[^0-9kK]/g, "").toUpperCase();
}

export function parseClientCsv(text: string): ClientCsvRow[] {
  return parseCsvText(text, clientCsvHeaders).rows.map((row) => {
    const parsed = rowSchema.safeParse({
      kind: row.tipo.toLowerCase() === "persona" ? "person" : row.tipo.toLowerCase() === "empresa" ? "company" : row.tipo,
      taxId: row.rut,
      legalName: row.nombre,
      giro: row.giro,
      email: row.correo,
      phone: row.telefono,
      addressLine: row.direccion,
      region: row.region,
      commune: row.comuna,
      city: row.ciudad,
      status: row.estado.toLowerCase() === "activo" ? "active" : row.estado.toLowerCase() === "inactivo" ? "inactive" : row.estado,
    });
    if (!parsed.success) throw new AppError("CSV_ROW_INVALID", `Fila ${row.__row}: ${parsed.error.issues[0]?.message ?? "datos inválidos"}`);
    return parsed.data;
  });
}

function rowInput(row: Record<string, string>) {
  return {
    kind: row.tipo.toLowerCase() === "persona" ? "person" : row.tipo.toLowerCase() === "empresa" ? "company" : row.tipo,
    taxId: row.rut,
    legalName: row.nombre,
    giro: row.giro,
    email: row.correo,
    phone: row.telefono,
    addressLine: row.direccion,
    region: row.region,
    commune: row.comuna,
    city: row.ciudad,
    status: row.estado.toLowerCase() === "activo" ? "active" : row.estado.toLowerCase() === "inactivo" ? "inactive" : row.estado,
  };
}

export function parseLegacyClientCsv(text: string): LegacyClientCsvRow[] {
  return parseCsvText(text, clientCsvHeaders).rows.map((row) => {
    const parsed = legacyRowSchema.safeParse(rowInput(row));
    if (!parsed.success) throw new AppError("CSV_ROW_INVALID", `Fila ${row.__row}: ${parsed.error.issues[0]?.message ?? "datos inválidos"}`);
    return { ...parsed.data, legacy: true };
  });
}

export function parseClientCsvForImport(text: string): Array<ClientCsvRow | LegacyClientCsvRow> {
  try {
    return parseClientCsv(text);
  } catch {
    return parseLegacyClientCsv(text);
  }
}

export function serializeClientsCsv(items: Array<{ kind: "person" | "company"; taxId: string | null; legalName: string; giro: string | null; email: string; phone: string | null; addressLine: string | null; region: string | null; commune: string | null; city: string | null; status: "active" | "inactive" }>): string {
  return serializeCsv(clientCsvHeaders, items.map((item) => [item.kind === "company" ? "empresa" : "persona", item.taxId, item.legalName, item.giro, item.email, item.phone, item.addressLine, item.region, item.commune, item.city, item.status === "active" ? "activo" : "inactivo"]));
}

export function clientCsvTemplate(): string {
  return serializeCsv(clientCsvHeaders, [["empresa", "76.123.456-0", "Comercial Intelly SpA", "Servicios informáticos", "facturacion@empresa.cl", "+56 9 1234 5678", "Av. Providencia 1234", "Región Metropolitana", "Providencia", "Santiago", "activo"]]);
}
