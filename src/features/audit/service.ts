import { randomUUID } from "node:crypto";
import { and, count, desc, eq, like, or, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { auditEvents, integrationAttempts } from "@/db/schema";
import { redactMetadata } from "@/lib/errors";
import type { PageQuery, PageResult } from "@/lib/list-query";

type AuditInput = {
  actorUserId?: string;
  actorType: "user" | "system" | "public";
  action: string;
  entityType: string;
  entityId?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
};

export function buildAuditEvent(input: AuditInput) {
  return {
    id: randomUUID(),
    actorUserId: input.actorUserId,
    actorType: input.actorType,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    correlationId: input.correlationId ?? randomUUID(),
    metadata: redactMetadata(input.metadata ?? {}),
  };
}

export async function writeAudit(input: AuditInput): Promise<void> {
  await getDb().insert(auditEvents).values(buildAuditEvent(input));
}

const integrationAttemptFields = { id: integrationAttempts.id, createdAt: integrationAttempts.createdAt, integration: integrationAttempts.integration, operation: integrationAttempts.operation, status: integrationAttempts.status, correlationId: integrationAttempts.correlationId, safeMessage: integrationAttempts.safeMessage, providerCode: integrationAttempts.providerCode };
type IntegrationAttemptListItem = { id: string; createdAt: Date; integration: string; operation: string; status: string; correlationId: string; safeMessage: string | null; providerCode: string | null };

export function listIntegrationAttempts(): Promise<IntegrationAttemptListItem[]>;
export function listIntegrationAttempts(query: PageQuery): Promise<PageResult<IntegrationAttemptListItem>>;
export async function listIntegrationAttempts(query?: PageQuery): Promise<IntegrationAttemptListItem[] | PageResult<IntegrationAttemptListItem>> {
  const db = getDb();
  const base = db.select(integrationAttemptFields).from(integrationAttempts);
  if (!query) return base.orderBy(desc(integrationAttempts.createdAt), desc(integrationAttempts.id)).limit(5_000).execute();

  const conditions: SQL[] = [];
  if (query.q) {
    const search = `%${query.q}%`;
    conditions.push(or(like(integrationAttempts.operation, search), like(integrationAttempts.correlationId, search), like(integrationAttempts.providerCode, search), like(integrationAttempts.safeMessage, search))!);
  }
  if (query.status) conditions.push(eq(integrationAttempts.status, query.status));
  if (typeof query.integration === "string") conditions.push(eq(integrationAttempts.integration, query.integration));
  const where = conditions.length ? and(...conditions) : undefined;
  const itemsQuery = where ? base.where(where) : base;
  const [items, [{ value: total }]] = await Promise.all([
    itemsQuery.orderBy(desc(integrationAttempts.createdAt), desc(integrationAttempts.id)).limit(query.pageSize).offset((query.page - 1) * query.pageSize).execute(),
    (where ? db.select({ value: count() }).from(integrationAttempts).where(where) : db.select({ value: count() }).from(integrationAttempts)).execute(),
  ]);
  return { items, page: query.page, pageSize: query.pageSize, total: Number(total) };
}
