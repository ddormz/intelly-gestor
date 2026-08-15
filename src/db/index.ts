import mysql, { type Pool } from "mysql2/promise";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/db/schema";
import { getEnv } from "@/lib/env";

type Db = MySql2Database<typeof schema>;
const globalDb = globalThis as typeof globalThis & { intellyPool?: Pool; intellyDb?: Db };

export function getPool(): Pool {
  if (!globalDb.intellyPool) {
    const env = getEnv();
    try {
      const url = new URL(env.DATABASE_URL);
      globalDb.intellyPool = mysql.createPool({
        host: url.hostname || "127.0.0.1",
        port: url.port ? Number(url.port) : 3306,
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: url.pathname.replace(/^\//, ""),
        connectionLimit: env.DB_POOL_LIMIT,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10_000,
        decimalNumbers: false,
      });
    } catch {
      globalDb.intellyPool = mysql.createPool(env.DATABASE_URL);
    }
  }
  return globalDb.intellyPool;
}

export function getDb(): Db {
  globalDb.intellyDb ??= drizzle({ client: getPool(), schema, mode: "default" });
  return globalDb.intellyDb;
}

export async function databaseHealth(): Promise<boolean> {
  try {
    await getPool().query("SELECT 1");
    return true;
  } catch (error) {
    console.error("Database health query failed:", error);
    return false;
  }
}
