import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, getPool } from "../src/db";
import { users } from "../src/db/schema";
import { hashPassword } from "../src/features/auth/password";

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME?.trim() || "Administrador";
if (!email || !password) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD in the process environment.");

const [existing] = await getDb().select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
if (existing) throw new Error("An account with that email already exists.");
await getDb().insert(users).values({ id: randomUUID(), email, name, passwordHash: await hashPassword(password), role: "admin", status: "active" });
console.info(`Administrator created for ${email}.`);
await getPool().end();
