import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("uses standard Next.js scripts and Node 22", async () => {
  const pkg = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
  assert.equal(pkg.scripts.dev, "next dev");
  assert.equal(pkg.scripts.build, "next build");
  assert.equal(pkg.scripts.start, "next start");
  assert.equal(pkg.engines.node, "22.x");
  assert.equal(pkg.dependencies?.vinext, undefined);
  assert.equal(pkg.devDependencies?.vinext, undefined);
  assert.equal(pkg.devDependencies?.wrangler, undefined);
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
