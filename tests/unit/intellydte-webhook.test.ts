import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyIntellyDteSignature } from "@/features/billing/emission";

describe("IntellyDTE webhook contract", () => {
  it("accepts sha256 signatures only for the exact raw body", () => {
    const body = '{"event":"dte.accepted"}';
    const valid = `sha256=${createHmac("sha256", "webhook-secret").update(body).digest("hex")}`;
    expect(verifyIntellyDteSignature(body, valid, "webhook-secret")).toBe(true);
    expect(verifyIntellyDteSignature(`${body} `, valid, "webhook-secret")).toBe(false);
  });
});
