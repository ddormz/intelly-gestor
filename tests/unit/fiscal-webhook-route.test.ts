import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/billing/emission", () => ({ handleIntellyDteWebhook: vi.fn(async () => ({ accepted: true, duplicate: false, eventId: "evt-1", status: "processed" })) }));

import { GET, POST } from "@/app/api/webhooks/intellydte/route";
import { handleIntellyDteWebhook } from "@/features/billing/emission";

describe("IntellyDTE webhook route", () => {
  it("responds to GET with ok and service status", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.service).toBe("intellydte-webhook");
    expect(body.status).toBe("ready");
  });

  it("passes the exact raw body and signature to the server handler", async () => {
    const body = '{"eventId":"evt-1"}';
    const signature = `sha256=${createHmac("sha256", "secret").update(body).digest("hex")}`;
    const response = await POST(new Request("http://localhost/api/webhooks/intellydte", { method: "POST", body, headers: { "x-intelly-signature": signature } }));
    expect(response.status).toBe(200);
    expect(handleIntellyDteWebhook).toHaveBeenCalledWith(body, signature);
  });

  it("extracts alternate signature and apiKey headers", async () => {
    const body = '{"eventId":"evt-2"}';
    const rawSignature = createHmac("sha256", "secret").update(body).digest("hex");
    const response = await POST(new Request("http://localhost/api/webhooks/intellydte", {
      method: "POST",
      body,
      headers: {
        "x-intellydte-signature": rawSignature,
        "x-api-key": "my-tenant-key",
      },
    }));
    expect(response.status).toBe(200);
    expect(handleIntellyDteWebhook).toHaveBeenCalledWith(body, rawSignature, undefined, "my-tenant-key");
  });
});

