import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db";
import { handleIntellyDteWebhook } from "@/features/billing/emission";

vi.mock("@/db", () => ({ getDb: vi.fn() }));
vi.mock("@/features/integrations/config-service", () => ({ getIntellyDteWebhookSecret: vi.fn(async () => "webhook-secret"), getIntellyDteConfig: vi.fn() }));
vi.mock("@/features/audit/service", () => ({ buildAuditEvent: vi.fn(() => ({ id: "audit", correlationId: "corr", metadata: {} })) }));

function chain<T>(result: T) {
  const value = { from: vi.fn(() => value), where: vi.fn(() => value), limit: vi.fn(() => value), execute: vi.fn(async () => result) };
  return value;
}

describe("fiscal webhook persistence", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stores a redacted unknown event and deduplicates a processed provider event", async () => {
    const inserted: Array<Record<string, unknown>> = [];
    const db = {
      select: vi.fn().mockReturnValueOnce(chain([])).mockReturnValueOnce(chain([])).mockReturnValueOnce(chain([{ id: "event-1", processedAt: new Date() }])),
      insert: vi.fn(() => ({ values: vi.fn(async (value: Record<string, unknown>) => { inserted.push(value); }) })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) })),
      transaction: vi.fn(async (callback: (tx: typeof db) => unknown) => callback(db)),
    };
    vi.mocked(getDb).mockReturnValue(db as never);
    const body = JSON.stringify({ eventId: "evt-1", event: "dte.unknown", data: { dteRecordId: "dte-1", tenantRut: "76123456-7", apiKey: "should-not-persist" } });
    const signature = `sha256=${createHmac("sha256", "webhook-secret").update(body).digest("hex")}`;

    const first = await handleIntellyDteWebhook(body, signature);
    const second = await handleIntellyDteWebhook(body, signature);

    expect(first.status).toBe("acknowledged_without_target");
    expect(second).toMatchObject({ duplicate: true, status: "duplicate" });
    expect(inserted[0]?.payload).toMatchObject({ data: { apiKey: "[REDACTED]" } });
  });
});
