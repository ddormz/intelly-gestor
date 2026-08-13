import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const connection = await mysql.createConnection(url);
try {
  await migrate(drizzle(connection), { migrationsFolder: "src/db/migrations" });
  console.info("Database migrations applied.");
} finally {
  await connection.end();
}
