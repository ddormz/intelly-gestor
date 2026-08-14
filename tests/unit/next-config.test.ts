import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("Next.js upload configuration", () => {
  it("allows the 2 MiB CSV limit enforced by the application", () => {
    expect(nextConfig.experimental?.serverActions?.bodySizeLimit).toBe("2mb");
  });
});
