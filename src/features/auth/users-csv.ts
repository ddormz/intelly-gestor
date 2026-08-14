import { z } from "zod";
import { AppError } from "@/lib/errors";
import { parseCsvText, serializeCsv } from "@/lib/csv";

const importHeaders = ["nombre", "correo", "rol", "estado", "contrasena_temporal"];
const rowSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  role: z.enum(["admin", "operator"]),
  status: z.enum(["active", "disabled"]),
  temporaryPassword: z.string().max(128),
});
export type UserCsvRow = z.infer<typeof rowSchema>;

export function parseUsersCsv(text: string): UserCsvRow[] {
  return parseCsvText(text, importHeaders).rows.map((row) => {
    const parsed = rowSchema.safeParse({
      name: row.nombre,
      email: row.correo,
      role: row.rol.toLowerCase() === "administrador" ? "admin" : row.rol.toLowerCase() === "operador" ? "operator" : row.rol,
      status: row.estado.toLowerCase() === "activo" ? "active" : row.estado.toLowerCase() === "desactivado" ? "disabled" : row.estado,
      temporaryPassword: row.contrasena_temporal,
    });
    if (!parsed.success) throw new AppError("CSV_ROW_INVALID", `Fila ${row.__row}: ${parsed.error.issues[0]?.message ?? "datos inválidos"}`);
    return parsed.data;
  });
}

export function serializeUsersCsv(items: Array<{ name: string; email: string; role: "admin" | "operator"; status: "active" | "disabled" | "locked" }>): string {
  return serializeCsv(["nombre", "correo", "rol", "estado"], items.map((item) => [item.name, item.email, item.role === "admin" ? "administrador" : "operador", item.status === "active" ? "activo" : item.status === "locked" ? "bloqueado" : "desactivado"]));
}

export function usersCsvTemplate(): string {
  return serializeCsv(importHeaders, [["María González", "maria@intelly.cl", "operador", "activo", "UnaClaveTemporal123"]]);
}
