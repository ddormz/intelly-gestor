import { beforeEach, describe, expect, it, vi } from "vitest";

const databaseHealth = vi.hoisted(() => vi.fn());
vi.mock("@/db", () => ({ databaseHealth }));

describe("GET /api/health", () => {
  beforeEach(() => databaseHealth.mockReset());

  it("reports ready when MySQL responds", async () => {
    databaseHealth.mockResolvedValue(true);
    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok", database: "available" });
  });

  it("reports unavailable without leaking internal errors", async () => {
    databaseHealth.mockResolvedValue(false);
    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ status: "degraded", database: "unavailable" });
  });
});
