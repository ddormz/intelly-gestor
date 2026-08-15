import { isIP } from "node:net";

export function normalizeRequestIp(realIp: string | null, forwardedFor: string | null): string {
  const direct = realIp?.trim();
  if (direct && isIP(direct)) return direct;
  const hops = forwardedFor?.split(",").map((value) => value.trim()).filter(Boolean) ?? [];
  const nearest = hops.at(-1);
  return nearest && isIP(nearest) ? nearest : "unknown";
}
