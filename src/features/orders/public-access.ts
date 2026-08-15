import { hashToken } from "@/lib/security";

const publicStatuses = new Set(["issued", "paid", "invoiced"]);

export function isPublicOrderAccessible(row: { publicTokenHash: string | null; status: string; publicExpiresAt: Date | null; publicRevokedAt: Date | null }, token: string, now = new Date()): boolean {
  return row.publicTokenHash === hashToken(token) && publicStatuses.has(row.status) && Boolean(row.publicExpiresAt && row.publicExpiresAt > now) && row.publicRevokedAt === null;
}
