import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { assertProviderMatchesOrder, buildFacturaPayload, verifyIntellyDteSignature } from "@/features/billing/emission";
import { parseSignedDteXmlBytes } from "@/features/billing/xml";

describe("fiscal emission orchestration contracts", () => {
  it("maps paid order snapshots to the DTE 33 NET payload", () => {
    const payload = buildFacturaPayload({ client: { taxId: "12345678-5", legalName: "CLIENTE SPA", giro: "Comercio", addressLine: "Destino 456", commune: "Providencia", city: "Santiago" }, order: { total: "1190", taxTotal: "190", discountTotal: "0", notes: "Nota" }, lines: [{ description: "Servicio", quantity: "2", subtotal: "1000", discountAmount: "0", taxRate: "19", taxAmount: "190", total: "1190", unitPrice: "500" }] });
    expect(payload).toMatchObject({ receptor: { rut: "12345678-5", razonSocial: "CLIENTE SPA", giro: "Comercio", direccion: "Destino 456", comuna: "Providencia", ciudad: "Santiago" }, montoNeto: 1000, montoIva: 190, montoTotal: 1190 });
    expect(payload.items[0]).toMatchObject({ nombre: "Servicio", cantidad: 2, precioUnitario: 500, montoItem: 1000 });
  });

  it("keeps the original unit price and expresses the line discount explicitly", () => {
    const payload = buildFacturaPayload({ client: { taxId: "12345678-5", legalName: "CLIENTE SPA", giro: "Comercio", addressLine: "Destino 456", commune: "Providencia", city: "Santiago" }, order: { total: "714", taxTotal: "114", discountTotal: "150", notes: null }, lines: [{ description: "Servicio", quantity: "3", subtotal: "750", discountAmount: "150", taxRate: "19", taxAmount: "114", total: "714", unitPrice: "250" }] });
    const item = payload.items[0]!;
    expect(item.precioUnitario).toBe(250);
    expect(item.descuentoMonto).toBe(150);
    expect(item.descuentoPct).toBe(20);
    expect(item.precioUnitario * item.cantidad - item.descuentoMonto!).toBe(item.montoItem);
  });

  it("rejects unsafe fiscal amounts before building the provider payload", () => {
    expect(() => buildFacturaPayload({ client: { taxId: "12345678-5", legalName: "CLIENTE SPA", giro: "Comercio", addressLine: "Destino 456", commune: "Providencia", city: "Santiago" }, order: { total: "100", taxTotal: "19", discountTotal: "-1", notes: null }, lines: [{ description: "Servicio", quantity: "1", subtotal: "100", discountAmount: "-1", taxRate: "19", taxAmount: "19", total: "118", unitPrice: "100" }] })).toThrow(/FISCAL|DISCOUNT|MONEY/);
  });

  it("decodes ISO-8859-1 signed XML without changing the original bytes", () => {
    const source = `<?xml version="1.0" encoding="ISO-8859-1"?><DTE><Documento><Encabezado><IdDoc><TipoDTE>33</TipoDTE><Folio>42</Folio><FchEmis>2026-08-15</FchEmis></IdDoc><Emisor><RUTEmisor>76123456-7</RUTEmisor><RznSoc>EMISOR SPA</RznSoc></Emisor><Receptor><RUTRecep>96543210-1</RUTRecep><RznSocRecep>NIÑO SPA</RznSocRecep></Receptor><Totales><MntNeto>100</MntNeto><IVA>19</IVA><MntTotal>119</MntTotal></Totales></Encabezado><Detalle><NmbItem>Servicio</NmbItem><MontoItem>100</MontoItem></Detalle><TED><DD><TD>33</TD><F>42</F></DD></TED></Documento></DTE>`;
    const bytes = Buffer.from(source, "latin1");
    expect(parseSignedDteXmlBytes(bytes).receiver.name).toBe("NIÑO SPA");
  });

  it("rejects signed XML whose fiscal identity or totals do not match the order", () => {
    const payload = buildFacturaPayload({ client: { taxId: "12345678-5", legalName: "CLIENTE SPA", giro: "Comercio", addressLine: "Destino 456", commune: "Providencia", city: "Santiago" }, order: { total: "1190", taxTotal: "190", discountTotal: "0", notes: null }, lines: [{ description: "Servicio", quantity: "2", subtotal: "1000", discountAmount: "0", taxRate: "19", taxAmount: "190", total: "1190", unitPrice: "500" }] });
    expect(() => assertProviderMatchesOrder({ kind: "issued", providerDocumentId: "dte-1", folio: "42", issuedAt: "2026-08-15T12:00:00Z", signedXmlBase64: "xml" }, { type: "33", folio: 42, receiver: { rut: "96543210-1", name: "OTHER", businessLine: null, address: null, commune: null, city: null }, totals: { net: 1000, exempt: 0, ivaRate: 19, iva: 190, total: 1190 } } as never, payload)).toThrow("receptor del XML firmado");
  });

  it("verifies the exact raw webhook body with a sha256 signature", () => {
    const rawBody = '{"eventId":"evt-1"}';
    const signature = `sha256=${createHmac("sha256", "secret").update(rawBody).digest("hex")}`;
    expect(verifyIntellyDteSignature(rawBody, signature, "secret")).toBe(true);
    expect(verifyIntellyDteSignature(rawBody, "sha256=bad", "secret")).toBe(false);
  });
});
