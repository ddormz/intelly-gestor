import { describe, expect, it } from "vitest";
import { redactMetadata } from "@/lib/errors";

describe("fiscal trace persistence", () => {
  it("preserves fiscal evidence while still redacting integration credentials", () => {
    const result = redactMetadata({ response: { printPayload: { signedXmlBase64: "xml", timbre: { tedXml: "ted", pdf417PngBase64: "png" } }, pdf: "%PDF" }, nested: [{ xml: "xml-2" }] });
    expect(result).toEqual({ response: { printPayload: { signedXmlBase64: "xml", timbre: { tedXml: "ted", pdf417PngBase64: "png" } }, pdf: "%PDF" }, nested: [{ xml: "xml-2" }] });
    expect(redactMetadata({ apiKey: "secret", password: "secret" })).toEqual({ apiKey: "[REDACTED]", password: "[REDACTED]" });
  });
});
