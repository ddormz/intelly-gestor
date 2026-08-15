import { describe, expect, it } from "vitest";
import { catalogItems, clients } from "@/db/schema";

describe("catalog and client schema contracts", () => {
  it("supports projects without changing historical client geography", () => {
    expect(catalogItems.type.enumValues).toContain("project");
    expect(clients.giro).toBeDefined();
    expect(clients.region).toBeDefined();
  });
});
