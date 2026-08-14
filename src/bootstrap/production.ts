import { parseBootstrapAdminConfig } from "./config";
import { createMySqlBootstrap } from "./mysql";
import { runStartupBootstrap } from "./startup";

export async function runProductionBootstrap(
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");

  const config = parseBootstrapAdminConfig(env);
  const adapter = await createMySqlBootstrap(databaseUrl);
  await runStartupBootstrap(config, adapter);
}
