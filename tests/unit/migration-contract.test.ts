import { randomUUID } from "node:crypto";
import path from "node:path";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { describe, expect, it } from "vitest";

const migrationTestDatabaseUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const migrationContract = migrationTestDatabaseUrl ? it : it.skip;

type InvoiceVersionColumn = RowDataPacket & {
  columnDefault: string | null;
  dataType: string;
  isNullable: "YES" | "NO";
};

describe("database migration contract", () => {
  migrationContract("creates a non-null invoice version column with default 1", async () => {
    const databaseName = `intelly_migration_contract_${randomUUID().replaceAll("-", "")}`;
    const adminUrl = new URL(migrationTestDatabaseUrl!);
    adminUrl.pathname = "/mysql";
    const databaseUrl = new URL(migrationTestDatabaseUrl!);
    databaseUrl.pathname = `/${databaseName}`;

    const adminConnection = await mysql.createConnection(adminUrl.toString());
    let connection: mysql.Connection | undefined;
    let databaseCreated = false;
    try {
      await adminConnection.query(`CREATE DATABASE \`${databaseName}\``);
      databaseCreated = true;
      connection = await mysql.createConnection(databaseUrl.toString());
      await migrate(drizzle(connection), {
        migrationsFolder: path.resolve(process.cwd(), "src/db/migrations"),
      });

      const [rows] = await connection.query<InvoiceVersionColumn[]>(
        `SELECT data_type AS dataType, is_nullable AS isNullable, column_default AS columnDefault
         FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = 'invoices' AND column_name = 'version'`,
      );

      expect(rows).toEqual([{ dataType: "int", isNullable: "NO", columnDefault: "1" }]);
    } finally {
      await connection?.end();
      if (databaseCreated) await adminConnection.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
      await adminConnection.end();
    }
  });
});
