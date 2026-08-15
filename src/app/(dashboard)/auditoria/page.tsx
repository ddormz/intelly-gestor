import { requireUser } from "@/features/auth/session";
import { listAuditEvents } from "@/features/audit/service";
import { parsePageQuery } from "@/lib/list-query";
import { AuditManager } from "./audit-manager";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser("admin");
  const query = parsePageQuery(await searchParams);
  const result = await listAuditEvents(query);

  return (
    <AuditManager
      events={result.items.map((item) => ({
        id: item.id,
        createdAt: item.createdAt.toISOString(),
        actorUserId: item.actorUserId,
        actorName: item.actorName,
        actorType: item.actorType,
        action: item.action,
        entityType: item.entityType,
        entityId: item.entityId,
        correlationId: item.correlationId,
        metadata: item.metadata,
      }))}
      query={query}
      page={result.page}
      pageSize={result.pageSize}
      total={result.total}
    />
  );
}
