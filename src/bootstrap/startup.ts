import type { BootstrapAdminConfig } from "./config";

export interface StartupBootstrapPort {
  acquireLock(): Promise<boolean>;
  migrate(): Promise<void>;
  ensureAdmin(config: Extract<BootstrapAdminConfig, { enabled: true }>): Promise<"created" | "existing">;
  releaseLock(): Promise<void>;
  close(): Promise<void>;
}

export type BootstrapLogger = { info(message: string): void };

export async function runStartupBootstrap(
  config: BootstrapAdminConfig,
  port: StartupBootstrapPort,
  logger: BootstrapLogger = console,
): Promise<void> {
  let locked = false;
  try {
    locked = await port.acquireLock();
    if (!locked) throw new Error("Could not acquire the bootstrap lock.");
    await port.migrate();
    logger.info("Database migrations applied.");

    if (config.enabled) {
      const result = await port.ensureAdmin(config);
      logger.info(result === "created"
        ? "Bootstrap administrator created."
        : "Bootstrap administrator already exists.");
    } else {
      logger.info("Administrator bootstrap disabled.");
    }
  } finally {
    if (locked) await port.releaseLock();
    await port.close();
  }
}
