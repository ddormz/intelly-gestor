import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parseSignedDteXml, renderFiscalPdf, renderTedPdf417 } from "@/features/billing/xml";

const fixture = new URL("../fixtures/fiscal/factura-33-signed.xml", import.meta.url);

describe("signed DTE XML and local fiscal PDF", () => {
  it("parses namespace-qualified DTE 33 values and preserves the TED", async () => {
    const xml = await readFile(fixture, "utf8");
    const document = parseSignedDteXml(xml);
    expect(document).toMatchObject({ type: "33", folio: 42, issuer: { rut: "76123456-7", name: "EMISOR SPA" }, receiver: { rut: "96543210-1", name: "CLIENTE SPA" }, totals: { net: 1000, iva: 190, total: 1190 } });
    expect(document.details).toHaveLength(1);
    expect(document.references[0]).toMatchObject({ type: "801", folio: "7" });
    expect(document.tedXml).toContain("<TED version=\"1.0\">");
  });

  it("renders PDF417 from the original TED and reconstructs a PDF with fiscal values", async () => {
    const document = parseSignedDteXml(await readFile(fixture, "utf8"));
    const pdf417 = await renderTedPdf417(document.tedXml);
    const pdf = await renderFiscalPdf(document);
    expect(pdf417).toMatch(/^data:image\/png;base64,/);
    expect(new TextDecoder().decode(pdf.slice(0, 4))).toBe("%PDF");
    expect(pdf.byteLength).toBeGreaterThan(1000);
  });

  it("rejects incomplete fiscal XML", () => {
    expect(() => parseSignedDteXml("<DTE><Documento><Encabezado/></Documento></DTE>")).toThrow(/DTE_XML_MISSING/);
  });

  it("rejects negative XML money values", () => {
    expect(() => parseSignedDteXml("<DTE><Documento><Encabezado><IdDoc><TipoDTE>33</TipoDTE><Folio>1</Folio><FchEmis>2026-08-15</FchEmis></IdDoc><Emisor><RUTEmisor>1-9</RUTEmisor><RznSoc>E</RznSoc></Emisor><Receptor><RUTRecep>2-7</RUTRecep><RznSocRecep>R</RznSocRecep></Receptor><Totales><MntNeto>-1</MntNeto><MntTotal>0</MntTotal></Totales></Encabezado><Detalle><NmbItem>X</NmbItem><MontoItem>-1</MontoItem></Detalle><TED><DD/></TED></Documento></DTE>")).toThrow(/DTE_XML_INVALID_(NET|LINE_PRICE)/);
  });

  it("rejects missing required totals and line price instead of defaulting them", () => {
    const missingTotal = "<DTE><Documento><Encabezado><IdDoc><TipoDTE>33</TipoDTE><Folio>1</Folio><FchEmis>2026-08-15</FchEmis></IdDoc><Emisor><RUTEmisor>1-9</RUTEmisor><RznSoc>E</RznSoc></Emisor><Receptor><RUTRecep>2-7</RUTRecep><RznSocRecep>R</RznSocRecep></Receptor><Totales><IVA>0</IVA><MntTotal>0</MntTotal></Totales></Encabezado><Detalle><NmbItem>X</NmbItem><PrcItem>1</PrcItem><MontoItem>1</MontoItem></Detalle><TED><DD/></TED></Documento></DTE>";
    expect(() => parseSignedDteXml(missingTotal)).toThrow("DTE_XML_INVALID_NET");
    const completeTotals = missingTotal.replace("<IVA>0>", "<MntNeto>1</MntNeto><IVA>0>");
    expect(() => parseSignedDteXml(completeTotals.replace("<PrcItem>1</PrcItem>", ""))).toThrow("DTE_XML_INVALID_LINE_PRICE");
  });

  it("keeps due date and explicit line discounts available to the renderer", async () => {
    const document = parseSignedDteXml(await readFile(fixture, "utf8"));
    document.dueDate = "2026-09-14";
    document.details[0]!.discountAmount = 100;
    document.details[0]!.discountPercent = 10;
    const pdf = await renderFiscalPdf(document);
    expect(new TextDecoder().decode(pdf)).toContain("%PDF");
  });
});
