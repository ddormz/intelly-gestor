import { and, asc, count, eq, like, or, type SQL } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { AppError } from "@/lib/errors";
import type { PageQuery, PageResult } from "@/lib/list-query";

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

const userFields = { id: users.id, name: users.name, email: users.email, role: users.role, status: users.status, lastLoginAt: users.lastLoginAt, createdAt: users.createdAt };
type UserListItem = typeof users["$inferSelect"];

export function listUsersForAdmin(): Promise<Array<Pick<UserListItem, "id" | "name" | "email" | "role" | "status" | "lastLoginAt" | "createdAt">>>;
export function listUsersForAdmin(query: PageQuery): Promise<PageResult<Pick<UserListItem, "id" | "name" | "email" | "role" | "status" | "lastLoginAt" | "createdAt">>>;
export async function listUsersForAdmin(query?: PageQuery): Promise<Array<Pick<UserListItem, "id" | "name" | "email" | "role" | "status" | "lastLoginAt" | "createdAt">> | PageResult<Pick<UserListItem, "id" | "name" | "email" | "role" | "status" | "lastLoginAt" | "createdAt">>> {
  const db = getDb();
  const base = db.select(userFields).from(users);
  if (!query) return base.orderBy(asc(users.name), asc(users.id)).execute();

  const conditions: SQL[] = [];
  if (query.q) {
    const search = `%${query.q}%`;
    conditions.push(or(like(users.name, search), like(users.email, search))!);
  }
  const status = query.status ?? query.tab;
  if (status === "active" || status === "disabled" || status === "locked") conditions.push(eq(users.status, status));
  const where = conditions.length ? and(...conditions) : undefined;
  const itemsQuery = where ? base.where(where) : base;
  const [items, [{ value: total }]] = await Promise.all([
    itemsQuery.orderBy(asc(users.name), asc(users.id)).limit(query.pageSize).offset((query.page - 1) * query.pageSize).execute(),
    (where ? db.select({ value: count() }).from(users).where(where) : db.select({ value: count() }).from(users)).execute(),
  ]);
  return { items, page: query.page, pageSize: query.pageSize, total: Number(total) };
}
