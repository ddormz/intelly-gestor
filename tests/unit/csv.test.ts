import { describe, expect, it } from "vitest";
import { parseCsvText, serializeCsv } from "@/lib/csv";
import { parseClientCsv, parseClientCsvForImport, serializeClientsCsv } from "@/features/clients/csv";
import { parseCatalogCsv } from "@/features/catalog/csv";

describe("safe CSV interchange", () => {
  it("adds a UTF-8 BOM and preserves quoted Chilean text", () => {
    const csv = serializeCsv(["nombre", "descripción"], [["Ñandú, SpA", "Gestión"]]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"Ñandú, SpA"');
    expect(csv).toContain("Gestión");
  });

  it.each(["=1+1", "+SUM(A1)", "-2+3", "@cmd"])("neutralizes spreadsheet formulas in %s", (value) => {
    expect(serializeCsv(["valor"], [[value]])).toContain(`'${value}`);
  });

  it("parses BOM-prefixed CSV and reports row numbers", () => {
    const result = parseCsvText("\uFEFFnombre,correo\nIntelly,contacto@intelly.cl\n,mal", ["nombre", "correo"]);
    expect(result.rows[0]).toEqual({ nombre: "Intelly", correo: "contacto@intelly.cl", __row: 2 });
    expect(result.rows[1].__row).toBe(3);
  });

  it("rejects unexpected headers and excessive row counts", () => {
    expect(() => parseCsvText("otro\nvalor", ["nombre"])).toThrow(/encabezados/i);
    expect(() => parseCsvText("nombre\na\nb", ["nombre"], 1)).toThrow(/filas/i);
  });

  it("validates every client row before import", () => {
    const csv = "tipo,rut,nombre,giro,correo,telefono,direccion,region,comuna,ciudad,estado\nempresa,76.123.456-0,Intelly,Servicios,contacto@intelly.cl,,Av. Providencia 1234,Región Metropolitana,Providencia,Santiago,activo";
    expect(parseClientCsv(csv)[0]).toMatchObject({ kind: "company", legalName: "Intelly", status: "active" });
    expect(() => parseClientCsv(csv.replace("contacto@intelly.cl", "correo-invalido"))).toThrow(/fila 2/i);
  });

  it("round-trips incomplete historical clients through the legacy import path", () => {
    const csv = serializeClientsCsv([{ kind: "company", taxId: null, legalName: "Cliente histórico", giro: null, email: "historico@example.com", phone: null, addressLine: null, region: null, commune: null, city: null, status: "inactive" }]);
    expect(parseClientCsvForImport(csv)[0]).toMatchObject({ legacy: true, taxId: "", addressLine: "" });
    expect(() => parseClientCsv(csv)).toThrow(/fila|RUT|dirección/i);
  });

  it("normalizes catalog rows for import", () => {
    const csv = "tipo,codigo,nombre,descripcion,precio_clp,tratamiento_tributario,estado\nservicio,serv-001,Implementación,Mensual,150000,afecto,activo";
    expect(parseCatalogCsv(csv)[0]).toMatchObject({ type: "service", code: "SERV-001", unitPrice: 150000, taxCategory: "taxable" });
  });
});
