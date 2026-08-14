import { describe, expect, it } from "vitest";
import { clientStatusSchema, clientUpdateSchema } from "@/features/clients/validation";
import { catalogItemStatusSchema, catalogItemUpdateSchema } from "@/features/catalog/validation";

const id = "4fc73a41-4f1f-4bd1-a775-21b93af922d4";

describe("management CRUD validation", () => {
  it("requires a UUID when updating a client", () => {
    const input = { id: "invalid", kind: "company", taxId: "76.123.456-0", legalName: "Cliente", email: "cliente@example.com" };
    expect(clientUpdateSchema.safeParse(input).success).toBe(false);
  });

  it("accepts only logical client statuses", () => {
    expect(clientStatusSchema.parse({ id, status: "inactive" })).toEqual({ id, status: "inactive" });
    expect(clientStatusSchema.safeParse({ id, status: "deleted" }).success).toBe(false);
  });

  it("normalizes catalog codes during updates", () => {
    const parsed = catalogItemUpdateSchema.parse({ id, type: "service", code: " serv-001 ", name: "Servicio", description: "", unitPrice: "1000", taxCategory: "taxable" });
    expect(parsed.code).toBe("SERV-001");
  });

  it("accepts only logical catalog statuses", () => {
    expect(catalogItemStatusSchema.parse({ id, status: "active" })).toEqual({ id, status: "active" });
    expect(catalogItemStatusSchema.safeParse({ id, status: "deleted" }).success).toBe(false);
  });
});
