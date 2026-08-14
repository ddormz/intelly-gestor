import { randomUUID } from "node:crypto";
import path from "node:path";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { ensureBootstrapAdmin, type BootstrapAdminRepository } from "./admin";
import type { StartupBootstrapPort } from "./startup";

const LOCK_NAME = "intelly-gestor-bootstrap";
const LOCK_TIMEOUT_SECONDS = 30;

type LockRow = RowDataPacket & { acquired: number | null };
type UserRow = RowDataPacket & {
  role: "admin" | "operator";
  status: "active" | "disabled" | "locked";
};

export async function createMySqlBootstrap(databaseUrl: string): Promise<StartupBootstrapPort> {
  const connection = await mysql.createConnection(databaseUrl);
  const database = drizzle(connection);
  const repository: BootstrapAdminRepository = {
    async findByEmail(email) {
      const [rows] = await connection.execute<UserRow[]>(
        "SELECT role, status FROM users WHERE email = ? LIMIT 1",
        [email],
      );
      const user = rows[0];
      return user ? { role: user.role, status: user.status } : null;
    },
    async createAdmin(admin) {
      await connection.execute(
        "INSERT INTO users (id, email, name, password_hash, role, status) VALUES (?, ?, ?, ?, 'admin', 'active')",
        [randomUUID(), admin.email, admin.name, admin.passwordHash],
      );
    },
  };

  return {
    async acquireLock() {
      const [rows] = await connection.execute<LockRow[]>(
        "SELECT GET_LOCK(?, ?) AS acquired",
        [LOCK_NAME, LOCK_TIMEOUT_SECONDS],
      );
      return Number(rows[0]?.acquired) === 1;
    },
    async migrate() {
      await migrate(database, { migrationsFolder: path.resolve(process.cwd(), "src/db/migrations") });
    },
    ensureAdmin(config) {
      return ensureBootstrapAdmin(config, repository);
    },
    async releaseLock() {
      await connection.execute("SELECT RELEASE_LOCK(?)", [LOCK_NAME]);
    },
    async close() {
      await connection.end();
    },
  };
}
