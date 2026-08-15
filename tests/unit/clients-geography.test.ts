import { describe, expect, it } from "vitest";
import { cityForCommune, listCommunes, listRegions } from "@/features/clients/geography";
import { clientSchema } from "@/features/clients/validation";

const validClient = {
  kind: "company" as const,
  taxId: "76.123.456-0",
  legalName: "Empresa SpA",
  email: "a@b.cl",
  addressLine: "Av. Providencia 1234",
  region: "Región Metropolitana",
  commune: "Providencia",
  city: "Santiago",
};

describe("client geography and required fields", () => {
  it("maps a commune to its deterministic city", () => {
    expect(cityForCommune("Región Metropolitana", "Providencia")).toBe("Santiago");
    expect(listRegions()).toContain("Región Metropolitana");
    expect(listCommunes("Región Metropolitana")).toContain("Providencia");
  });

  it("requires address and the selected geography for new clients", () => {
    expect(clientSchema.safeParse({ ...validClient, addressLine: "" }).success).toBe(false);
    expect(clientSchema.safeParse({ ...validClient, city: "Valparaíso" }).success).toBe(false);
    expect(clientSchema.safeParse({ ...validClient, giro: "Servicios informáticos" }).success).toBe(true);
  });

  it("keeps historical nullable schema columns readable", () => {
    expect(clientSchema.safeParse({ ...validClient, region: undefined, commune: undefined, city: undefined }).success).toBe(false);
  });
});
