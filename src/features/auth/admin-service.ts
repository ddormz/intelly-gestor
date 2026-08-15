import { asc } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { AppError } from "@/lib/errors";

export const userUpdateSchema = z.object({ id: z.string().uuid(), name: z.string().trim().min(2).max(120), role: z.enum(["admin", "operator"]) });
export const userStatusSchema = z.object({ id: z.string().uuid(), status: z.enum(["active", "disabled"]) });

export function assertUserStatusChangeAllowed(currentUserId: string, targetUserId: string, status: "active" | "disabled"): void {
  if (currentUserId === targetUserId && status === "disabled") throw new AppError("SELF_DISABLE", "No puedes desactivar tu propia cuenta activa.");
}

export function resolveImportedUserStatus(
  currentUserId: string,
  targetUserId: string,
  currentStatus: "active" | "disabled" | "locked",
  requestedStatus: "active" | "disabled",
): "active" | "disabled" | "locked" {
  const nextStatus = requestedStatus === "disabled" ? "disabled" : currentStatus;
  assertUserStatusChangeAllowed(currentUserId, targetUserId, nextStatus === "disabled" ? "disabled" : "active");
  return nextStatus;
}

export function listUsersForAdmin() {
  return getDb().select({ id: users.id, name: users.name, email: users.email, role: users.role, status: users.status, lastLoginAt: users.lastLoginAt, createdAt: users.createdAt }).from(users).orderBy(asc(users.name));
}
