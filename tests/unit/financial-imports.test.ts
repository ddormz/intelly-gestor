import { describe, expect, it } from "vitest";
import { parseDraftOrdersCsv } from "@/features/orders/csv";
import { parseHistoricalInvoicesCsv } from "@/features/billing/csv";

describe("financial CSV policies", () => {
  it("accepts only positive draft-order quantities", () => {
    const csv = "rut_cliente,codigo,cantidad\n76.123.456-0,SERV-001,2";
    expect(parseDraftOrdersCsv(csv)[0]).toEqual({ clientTaxId: "76.123.456-0", catalogCode: "SERV-001", quantity: 2 });
    expect(() => parseDraftOrdersCsv(csv.replace(",2", ",0"))).toThrow(/fila 2/i);
  });

  it("requires folio, external id and a valid issue date for historical invoices", () => {
    const csv = "numero_orden,folio,id_externo,fecha_emision\nOP-20260814-ABC123,1001,DTE-1001,2026-08-14T12:00:00.000Z";
    expect(parseHistoricalInvoicesCsv(csv)[0]).toMatchObject({ orderNumber: "OP-20260814-ABC123", folio: "1001", providerDocumentId: "DTE-1001" });
    expect(() => parseHistoricalInvoicesCsv(csv.replace("DTE-1001", ""))).toThrow(/fila 2/i);
  });
});
