import { describe, expect, it } from "vitest";
import { getStatusLabel } from "@/lib/presentation";

describe("settled POS status presentation", () => {
  it.each([["paid", "Pagada"], ["invoiced", "Facturada"], ["expired", "Vencida"], ["cancelled", "Cancelada"]] as const)("translates %s as %s", (status, label) => {
    expect(getStatusLabel(status)).toBe(label);
    expect(getStatusLabel(status)).not.toBe(status);
  });
});
