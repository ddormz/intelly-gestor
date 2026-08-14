import { desc } from "drizzle-orm";
import { getDb, databaseHealth } from "@/db";
import { integrationAttempts } from "@/db/schema";
import { requireUser } from "@/features/auth/session";
import { getIntellyDteGateway } from "@/features/integrations/intellydte";
import { getIntellyDtePublicConfig } from "@/features/integrations/config-service";
import { IntegrationManager } from "./integration-manager";

export default async function IntegrationsPage() {
  await requireUser("admin");
  const gateway = await getIntellyDteGateway();
  const [dbOk, dte, config, attempts] = await Promise.all([databaseHealth(), gateway.health(), getIntellyDtePublicConfig(), getDb().select().from(integrationAttempts).orderBy(desc(integrationAttempts.createdAt)).limit(100)]);
  return <IntegrationManager dbOk={dbOk} dte={dte} config={{ ...config, updatedAt: config.updatedAt?.toISOString() ?? null }} attempts={attempts.map((attempt) => ({ id: attempt.id, createdAt: attempt.createdAt.toISOString(), operation: attempt.operation, status: attempt.status, correlationId: attempt.correlationId, safeMessage: attempt.safeMessage }))} />;
}
