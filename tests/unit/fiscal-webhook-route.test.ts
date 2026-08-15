import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/billing/emission", () => ({ handleIntellyDteWebhook: vi.fn(async () => ({ accepted: true, duplicate: false, eventId: "evt-1", status: "processed" })) }));

import { POST } from "@/app/api/webhooks/intellydte/route";
import { handleIntellyDteWebhook } from "@/features/billing/emission";

describe("IntellyDTE webhook route", () => {
  it("passes the exact raw body and signature to the server handler", async () => {
    const body = '{"eventId":"evt-1"}';
    const signature = `sha256=${createHmac("sha256", "secret").update(body).digest("hex")}`;
    const response = await POST(new Request("http://localhost/api/webhooks/intellydte", { method: "POST", body, headers: { "x-intelly-signature": signature } }));
    expect(response.status).toBe(200);
    expect(handleIntellyDteWebhook).toHaveBeenCalledWith(body, signature);
  });
});
