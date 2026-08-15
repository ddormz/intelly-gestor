import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("Next.js upload configuration", () => {
  it("allows multipart overhead above the 2 MiB CSV limit", () => {
    expect(nextConfig.experimental?.serverActions?.bodySizeLimit).toBe("3mb");
  });
});
