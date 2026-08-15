import { databaseHealth } from "@/db";
import { requireUser } from "@/features/auth/session";
import { listIntegrationAttempts } from "@/features/audit/service";
import { getIntellyDteGateway } from "@/features/integrations/intellydte";
import { getIntellyDtePublicConfig } from "@/features/integrations/config-service";
import { parsePageQuery } from "@/lib/list-query";
import { IntegrationManager } from "./integration-manager";

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireUser("admin");
  const query = parsePageQuery(await searchParams);
  const gateway = await getIntellyDteGateway();
  const [dbOk, dte, config, attempts] = await Promise.all([databaseHealth(), gateway.health(), getIntellyDtePublicConfig(), listIntegrationAttempts(query)]);
  return <IntegrationManager dbOk={dbOk} dte={dte} config={{ ...config, updatedAt: config.updatedAt?.toISOString() ?? null }} query={query} page={attempts.page} pageSize={attempts.pageSize} total={attempts.total} attempts={attempts.items.map((attempt) => ({ id: attempt.id, createdAt: attempt.createdAt.toISOString(), operation: attempt.operation, status: attempt.status, correlationId: attempt.correlationId, safeMessage: attempt.safeMessage }))} />;
}
