import { describe, expect, it } from "vitest";
import { redactMetadata } from "@/lib/errors";

describe("fiscal trace redaction", () => {
  it("removes nested signed XML, TED, PDF417, and fiscal PDF values from traces", () => {
    const result = redactMetadata({ response: { printPayload: { signedXmlBase64: "xml", timbre: { tedXml: "ted", pdf417PngBase64: "png" } }, pdf: "%PDF" }, nested: [{ xml: "xml-2" }] });
    expect(result).toEqual({ response: { printPayload: "[REDACTED]", pdf: "[REDACTED]" }, nested: [{ xml: "[REDACTED]" }] });
  });
});
