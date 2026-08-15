import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("billing fiscal evidence UI contract", () => {
  it("offers private PDF and XML actions for issued documents", async () => {
    const source = await readFile(new URL("../../src/app/(dashboard)/facturacion/billing-manager.tsx", import.meta.url), "utf8");
    expect(source).toContain("/api/invoices/");
    expect(source).toContain("Descargar PDF fiscal");
    expect(source).toContain("Descargar XML firmado");
    expect(source).toContain("Pagination");
  });

  it("defines authenticated evidence routes", async () => {
    const pdf = await readFile(new URL("../../src/app/api/invoices/[id]/pdf/route.ts", import.meta.url), "utf8");
    const xml = await readFile(new URL("../../src/app/api/invoices/[id]/xml/route.ts", import.meta.url), "utf8");
    expect(pdf).toContain("requireUser");
    expect(pdf).toContain("application/pdf");
    expect(xml).toContain("requireUser");
    expect(xml).toContain("application/xml");
  });
});
