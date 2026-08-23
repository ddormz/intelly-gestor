import { describe, expect, it } from "vitest";
import { isSiiAcceptedStatus } from "@/features/integrations/sii-status";

describe("SII status helpers", () => {
  it.each(["DOK", "ACCEPTED", "ACEPTADO", " dok "])("recognizes %s as an explicit acceptance", (status) => {
    expect(isSiiAcceptedStatus(status)).toBe(true);
  });

  it.each([undefined, null, "ENQUEUED", "PROCESSING", "SOA", ""])("does not recognize %s as accepted", (status) => {
    expect(isSiiAcceptedStatus(status)).toBe(false);
  });
});
