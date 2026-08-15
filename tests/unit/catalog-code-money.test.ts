import { describe, expect, it } from "vitest";
import { formatClpInput, parseClpInput } from "@/components/ui/money-input";
import { generateCatalogCode } from "@/features/catalog/code";

describe("catalog code and CLP input contracts", () => {
  it("creates a deterministic ten-character code from an accented name", () => {
    expect(generateCatalogCode("Implementación mensual", [])).toBe("IMPLEMENTA");
  });

  it("resolves code collisions without exceeding ten characters", () => {
    const code = generateCatalogCode("Proyecto Ágil", ["PROYECTOAG"]);
    expect(code).not.toBe("PROYECTOAG");
    expect(code).toMatch(/^[A-Z0-9]{2,10}$/);
  });

  it("creates a valid short code for a one-character name", () => {
    expect(generateCatalogCode("A", [])).toMatch(/^[A-Z0-9]{2,10}$/);
  });

  it("normalizes formatted CLP input to an integer", () => {
    expect(parseClpInput("$ 1.250.000")).toBe(1_250_000);
    expect(formatClpInput(1_250_000)).toContain("1.250.000");
  });
});
