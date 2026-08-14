import { runProductionBootstrap } from "../src/bootstrap/production";

if (!process.env.DATABASE_URL && process.env.BOOTSTRAP_ADMIN_ENABLED !== "true") {
  console.info("Database build bootstrap skipped: DATABASE_URL is not configured.");
} else {
  await runProductionBootstrap();
}
