import { describe, expect, it } from "vitest";
import { ensureBootstrapAdmin, type BootstrapAdminRepository } from "@/bootstrap/admin";
import { parseBootstrapAdminConfig } from "@/bootstrap/config";
import { runStartupBootstrap, type StartupBootstrapPort } from "@/bootstrap/startup";

const enabled = {
  enabled: true as const,
  email: "admin@intelly.cl",
  name: "Administrador",
  password: "a-secure-passphrase",
};

class MemoryUsers implements BootstrapAdminRepository {
  user: { role: "admin" | "operator"; status: "active" | "disabled" | "locked" } | null = null;
  created: { email: string; name: string; passwordHash: string }[] = [];
  async findByEmail() { return this.user; }
  async createAdmin(admin: { email: string; name: string; passwordHash: string }) { this.created.push(admin); }
}

class MemoryBootstrap implements StartupBootstrapPort {
  events: string[] = [];
  lockAvailable = true;
  failMigration = false;
  async acquireLock() { this.events.push("lock"); return this.lockAvailable; }
  async migrate() { this.events.push("migrate"); if (this.failMigration) throw new Error("migration failed"); }
  async ensureAdmin() { this.events.push("admin"); return "created" as const; }
  async releaseLock() { this.events.push("release"); }
  async close() { this.events.push("close"); }
}

describe("bootstrap configuration", () => {
  it("ignores administrator values when bootstrap is disabled", () => {
    expect(parseBootstrapAdminConfig({
      BOOTSTRAP_ADMIN_ENABLED: "false",
      ADMIN_EMAIL: "invalid",
      ADMIN_PASSWORD: "short",
    })).toEqual({ enabled: false });
  });

  it("normalizes an enabled bootstrap", () => {
    expect(parseBootstrapAdminConfig({
      BOOTSTRAP_ADMIN_ENABLED: "true",
      ADMIN_EMAIL: " ADMIN@INTELLY.CL ",
      ADMIN_NAME: " Daniel ",
      ADMIN_PASSWORD: "a-secure-passphrase",
    })).toEqual({ ...enabled, name: "Daniel" });
  });

  it("rejects incomplete enabled configuration", () => {
    expect(() => parseBootstrapAdminConfig({
      BOOTSTRAP_ADMIN_ENABLED: "true",
      ADMIN_EMAIL: "admin@intelly.cl",
    })).toThrow();
  });
});

describe("administrator bootstrap", () => {
  it("creates an administrator using a password hash", async () => {
    const users = new MemoryUsers();
    await expect(ensureBootstrapAdmin(enabled, users, async () => "argon-hash")).resolves.toBe("created");
    expect(users.created).toEqual([{
      email: "admin@intelly.cl",
      name: "Administrador",
      passwordHash: "argon-hash",
    }]);
  });

  it("leaves an existing active administrator unchanged", async () => {
    const users = new MemoryUsers();
    users.user = { role: "admin", status: "active" };
    await expect(ensureBootstrapAdmin(enabled, users, async () => "unused")).resolves.toBe("existing");
    expect(users.created).toEqual([]);
  });

  it("refuses to elevate an incompatible existing account", async () => {
    const users = new MemoryUsers();
    users.user = { role: "operator", status: "active" };
    await expect(ensureBootstrapAdmin(enabled, users, async () => "unused")).rejects.toThrow(/incompatible/i);
    expect(users.created).toEqual([]);
  });
});

describe("startup orchestration", () => {
  it("migrates without creating an administrator when disabled", async () => {
    const adapter = new MemoryBootstrap();
    await runStartupBootstrap({ enabled: false }, adapter, { info() {} });
    expect(adapter.events).toEqual(["lock", "migrate", "release", "close"]);
  });

  it("migrates before creating an enabled administrator", async () => {
    const adapter = new MemoryBootstrap();
    await runStartupBootstrap(enabled, adapter, { info() {} });
    expect(adapter.events).toEqual(["lock", "migrate", "admin", "release", "close"]);
  });

  it("does not migrate without the lock and still closes", async () => {
    const adapter = new MemoryBootstrap();
    adapter.lockAvailable = false;
    await expect(runStartupBootstrap({ enabled: false }, adapter, { info() {} })).rejects.toThrow(/lock/i);
    expect(adapter.events).toEqual(["lock", "close"]);
  });

  it("releases and closes after a migration failure", async () => {
    const adapter = new MemoryBootstrap();
    adapter.failMigration = true;
    await expect(runStartupBootstrap({ enabled: false }, adapter, { info() {} })).rejects.toThrow("migration failed");
    expect(adapter.events).toEqual(["lock", "migrate", "release", "close"]);
  });
});
