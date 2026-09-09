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

  it("accepts raw 64-character hex signatures without the sha256= prefix", () => {
    const body = '{"event":"dte.accepted"}';
    const rawHex = createHmac("sha256", "webhook-secret").update(body).digest("hex");
    expect(verifyIntellyDteSignature(body, rawHex, "webhook-secret")).toBe(true);
    expect(verifyIntellyDteSignature(body, rawHex.toUpperCase(), "webhook-secret")).toBe(true);
  });
});
