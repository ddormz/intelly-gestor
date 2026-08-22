import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);

test("uses standard Next.js scripts and Node 22", async () => {
  const pkg = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
  assert.equal(pkg.scripts.dev, "next dev");
  assert.equal(pkg.scripts.build, "next build");
  assert.match(pkg.engines.node, /22/);
  assert.equal(pkg.dependencies?.vinext, undefined);
  assert.equal(pkg.devDependencies?.vinext, undefined);
  assert.equal(pkg.devDependencies?.wrangler, undefined);
});

test("runs the secure bootstrap through the standard production start command", async () => {
  const pkg = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
  assert.equal(pkg.scripts.start, "tsx scripts/start-production.ts");
  await access(new URL("scripts/start-production.ts", root));
});

test("validates migrations and the complete application on every pushed revision", async () => {
  const workflow = await readFile(new URL(".github/workflows/ci.yml", root), "utf8");

  assert.match(workflow, /^on:\s*[\s\S]*?push:/m);
  assert.match(workflow, /image:\s*mysql:8\.4/);
  for (const command of [
    "npm ci",
    "npm run db:migrate",
    "npm test",
    "npm run typecheck",
    "npm run lint",
    "npm run build",
  ]) {
    assert.match(workflow, new RegExp(`run: ${command.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}`));
  }
});

test("runs the secure bootstrap before managed production builds", async () => {
  const pkg = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
  assert.equal(pkg.scripts.prebuild, "tsx scripts/bootstrap-build.ts");

  const tsx = fileURLToPath(new URL("node_modules/tsx/dist/cli.mjs", root));
  const script = fileURLToPath(new URL("scripts/bootstrap-build.ts", root));
  const env = { ...process.env };
  for (const name of [
    "DATABASE_URL",
    "BOOTSTRAP_ADMIN_ENABLED",
    "ADMIN_EMAIL",
    "ADMIN_NAME",
    "ADMIN_PASSWORD",
  ]) delete env[name];

  const result = spawnSync(process.execPath, [tsx, script], {
    cwd: fileURLToPath(root),
    encoding: "utf8",
    env,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Database build bootstrap skipped/);
});

test("keeps build and deployment tooling in the production dependency tree", async () => {
  const lock = JSON.parse(await readFile(new URL("package-lock.json", root), "utf8"));
  const production = lock.packages[""].dependencies;
  assert.equal(production["@tailwindcss/postcss"], "latest");
  assert.equal(production.tailwindcss, "latest");
  assert.equal(production.typescript, "7.0.2");
  assert.equal(production.tsx, "latest");
  assert.equal(production["@types/nodemailer"], "^8.0.1");
});

test("keeps development-only TypeScript inputs out of the production program", async () => {
  const tsc = fileURLToPath(new URL("node_modules/typescript/lib/tsc.js", root));
  const result = spawnSync(process.execPath, [tsc, "--noEmit", "--listFiles", "--pretty", "false"], {
    cwd: fileURLToPath(root),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.doesNotMatch(
    result.stdout,
    /[\\/](tests[\\/]|vitest\.config\.ts|drizzle\.config\.ts|playwright\.config\.ts)/,
  );
});

test("does not ship Cloudflare runtime files", async () => {
  for (const path of [
    ".openai/hosting.json",
    "vite.config.ts",
    "worker/index.ts",
    "build/sites-vite-plugin.ts",
  ]) {
    await assert.rejects(access(new URL(path, root)));
  }
});

test("documents the production deployment without secrets", async () => {
  const guide = await readFile(new URL("docs/hostinger-deployment.md", root), "utf8");
  assert.match(guide, /gestion\.intelly\.cl/);
  assert.match(guide, /Node\.js 22/);
  assert.match(guide, /npm run build/);
  assert.match(guide, /npm run start/);
  assert.match(guide, /ddormz\/intelly-gestor/);
  assert.match(guide, /variables de entorno/i);
});
