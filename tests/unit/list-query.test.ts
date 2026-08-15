import { describe, expect, it } from "vitest";
import { parsePageQuery, withPageQuery } from "@/lib/list-query";

describe("list query", () => {
  it("normalizes invalid values and bounds page size", () => {
    expect(parsePageQuery({ page: "0", pageSize: "999", q: "  cliente " })).toMatchObject({
      page: 1,
      pageSize: 100,
      q: "cliente",
    });
  });

  it("resets page when a search or filter changes", () => {
    expect(withPageQuery({ page: "4", q: "old" }, { q: "new" })).toEqual({ page: "1", q: "new" });
  });

  it("uses the first value for duplicate parameters and caps search text", () => {
    expect(parsePageQuery({ page: ["3", "8"], pageSize: ["50", "10"], q: [`${"x".repeat(130)}`, "ignored"], status: ["active", "inactive"] })).toEqual({
      page: 3,
      pageSize: 50,
      q: "x".repeat(120),
      status: "active",
    });
  });

  it("falls back for malformed numbers instead of accepting permissive prefixes", () => {
    expect(parsePageQuery({ page: "2clientes", pageSize: "11", q: "   " })).toEqual({ page: 1, pageSize: 25 });
  });

  it("defaults invalid module tabs to the active tab", () => {
    expect(parsePageQuery({ tab: "pending" }, { allowedTabs: ["active", "inactive", "all"], defaultTab: "active" }).tab).toBe("active");
    expect(parsePageQuery({ tab: "inactive" }, { allowedTabs: ["active", "inactive", "all"], defaultTab: "active" }).tab).toBe("inactive");
  });
});
