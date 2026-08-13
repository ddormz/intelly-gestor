import { randomUUID } from "node:crypto";
import { getDb } from "@/db";
import { auditEvents } from "@/db/schema";
import { redactMetadata } from "@/lib/errors";

type AuditInput = {
  actorUserId?: string;
  actorType: "user" | "system" | "public";
  action: string;
  entityType: string;
  entityId?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
};

export async function writeAudit(input: AuditInput): Promise<void> {
  await getDb().insert(auditEvents).values({
    id: randomUUID(),
    actorUserId: input.actorUserId,
    actorType: input.actorType,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    correlationId: input.correlationId ?? randomUUID(),
    metadata: redactMetadata(input.metadata ?? {}),
  });
}
