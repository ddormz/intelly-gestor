import { describe, expect, it } from "vitest";
import { validChileanRut } from "@/features/clients/validation";
import { FakeIntellyDteGateway } from "@/features/integrations/intellydte";

describe("client and integration contracts", () => {
  it("validates Chilean RUT check digits", () => {
    expect(validChileanRut("12.345.678-5")).toBe(true);
    expect(validChileanRut("12.345.678-9")).toBe(false);
  });

  it("returns the same provider identity for a repeated business key", async () => {
    const gateway = new FakeIntellyDteGateway();
    const command = { idempotencyKey: "invoice:order-123", correlationId: "c-1", orderNumber: "OP-1", total: "11900", recipientTaxId: "12345678-5" };
    const first = await gateway.issueInvoice(command);
    const second = await gateway.issueInvoice({ ...command, correlationId: "c-2" });
    expect(first.kind).toBe("issued");
    expect(second.kind).toBe("issued");
    if (first.kind === "issued" && second.kind === "issued") {
      expect(second.providerDocumentId).toBe(first.providerDocumentId);
      expect(second.folio).toBe(first.folio);
    }
  });
});
