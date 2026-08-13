# GitHub and Hostinger Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the Intelly payment-order generator from the private `ddormz/intelly-gestor` GitHub repository at `https://gestion.intelly.cl`, with a safe JSON backup/restore flow and a standard Next.js Node.js runtime suitable for a later Intelly DTE integration.

**Architecture:** Replace the Cloudflare/Vinext adapter with standard Next.js while preserving the browser-only PDF and `localStorage` behavior. Add a pure, versioned backup module consumed by the page UI, then connect the verified `main` branch to Hostinger's managed Node.js deployment. Server-side DTE code is deliberately excluded, but secrets and future API boundaries are documented.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Node.js 22, jsPDF, Node test runner, tsx, GitHub private repository, Hostinger Node.js Web App.

## Global Constraints

- Use Node.js 22.
- Use `npm ci`, `npm run build`, and `npm run start` in production.
- Keep `main` as the production branch.
- Keep all current order, discount, PDF, branding, and history behavior.
- Keep current application data in browser `localStorage` for this release.
- Never commit GitHub, Hostinger, DTE, database, certificate, or API credentials.
- Store future Intelly DTE credentials only in Hostinger environment variables.
- The production URL is `https://gestion.intelly.cl`.
- The production repository is private: `https://github.com/ddormz/intelly-gestor.git`.

---

### Task 1: Preserve and baseline the current product changes

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Modify: `lib/order-pdf.ts`
- Modify: `scripts/generate-sample-pdf.ts`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: Existing discount and compact PDF work in the dirty worktree.
- Produces: A clean, tested baseline commit before runtime migration.

- [ ] **Step 1: Inspect the existing diff for unrelated or generated files**

Run:

```powershell
git diff --check
git status --short
git diff -- app/page.tsx app/globals.css lib/order-pdf.ts scripts/generate-sample-pdf.ts tests/rendered-html.test.mjs
```

Expected: only the approved discount, payment block, PDF pagination, summary spacing, sample, and regression-test changes appear.

- [ ] **Step 2: Run the current regression suite**

Run:

```powershell
npm test
npm run lint
npm run pdf:sample
```

Expected: all commands exit `0`; the compact sample asserts one PDF page.

- [ ] **Step 3: Commit only the existing product changes**

```powershell
git add app/page.tsx app/globals.css lib/order-pdf.ts scripts/generate-sample-pdf.ts tests/rendered-html.test.mjs
git commit -m "feat: add discounts and compact payment PDFs"
```

Expected: documentation commits and product changes are preserved before deployment work begins.

---

### Task 2: Add a versioned and validated backup format

**Files:**
- Create: `lib/order-backup.ts`
- Create: `tests/order-backup.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: `CompanySettings` and `PaymentOrder` from `lib/order-pdf.ts`.
- Produces:
  - `BACKUP_FORMAT: "intelly-payment-orders"`
  - `BACKUP_VERSION: 1`
  - `STORAGE_KEYS`
  - `OrderBackupV1`
  - `createOrderBackup(settings, orders, sequence, exportedAt): OrderBackupV1`
  - `parseOrderBackup(source: string): OrderBackupV1`

- [ ] **Step 1: Add tsx as a direct test dependency**

Run:

```powershell
npm install --save-dev tsx@^4.22.1
```

Add the backup test to `package.json` without changing the current build test yet:

```json
"test:backup": "tsx --test tests/order-backup.test.ts"
```

- [ ] **Step 2: Write failing backup contract tests**

Create `tests/order-backup.test.ts` with representative settings, one order, and a sequence:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  createOrderBackup,
  parseOrderBackup,
} from "../lib/order-backup";
import type { CompanySettings, PaymentOrder } from "../lib/order-pdf";

const settings: CompanySettings = {
  companyName: "INTELLY SPA",
  companyRut: "78.202.703-4",
  businessLine: "Tecnología",
  address: "Santiago",
  email: "dramirez@intelly.cl",
  phone: "+56900000000",
  bankName: "Banco de Chile",
  accountType: "Cuenta Corriente",
  accountNumber: "00-171-21318-01",
  accountHolder: "INTELLY SPA",
  accountRut: "78.202.703-4",
  transferEmail: "dramirez@intelly.cl",
  paymentTerms: "Pago al vencimiento.",
  paymentInstructions: "Indicar el número de orden.",
  dueDays: 10,
};

const order: PaymentOrder = {
  id: "order-1",
  number: "OP-2026-0002",
  committed: true,
  issueDate: "2026-08-12",
  dueDate: "2026-08-22",
  customerName: "Cliente",
  customerRut: "11.111.111-1",
  customerEmail: "cliente@example.com",
  serviceType: "hosting",
  invoice: true,
  discountPercent: 20,
  discountReason: "Antigüedad",
  items: [{ id: "item-1", name: "Hosting", description: "Anual", amount: 100000 }],
};

test("creates a versioned complete backup", () => {
  const backup = createOrderBackup(settings, [order], { "2026": 2 }, "2026-08-12T12:00:00.000Z");
  assert.equal(backup.format, BACKUP_FORMAT);
  assert.equal(backup.version, BACKUP_VERSION);
  assert.deepEqual(backup.data.settings, settings);
  assert.deepEqual(backup.data.orders, [order]);
  assert.deepEqual(backup.data.sequence, { "2026": 2 });
});

test("parses a valid serialized backup", () => {
  const source = JSON.stringify(createOrderBackup(settings, [order], { "2026": 2 }, "2026-08-12T12:00:00.000Z"));
  assert.deepEqual(parseOrderBackup(source).data.orders, [order]);
});

test("rejects invalid JSON, versions, settings, orders, and sequences", () => {
  assert.throws(() => parseOrderBackup("{"), /JSON válido/);
  assert.throws(() => parseOrderBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 2, data: {} })), /versión compatible/);
  assert.throws(() => parseOrderBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 1, exportedAt: "2026-08-12T12:00:00.000Z", data: { settings: {}, orders: [], sequence: {} } })), /configuración válida/);
});
```

- [ ] **Step 3: Run the backup tests and verify RED**

Run: `npm run test:backup`

Expected: FAIL because `lib/order-backup.ts` does not exist.

- [ ] **Step 4: Implement the minimal backup module**

Create `lib/order-backup.ts` with these exact top-level contracts:

```ts
import type { CompanySettings, PaymentOrder } from "./order-pdf";

export const BACKUP_FORMAT = "intelly-payment-orders" as const;
export const BACKUP_VERSION = 1 as const;

export const STORAGE_KEYS = {
  settings: "intelly.op.settings.v1",
  orders: "intelly.op.orders.v1",
  sequence: "intelly.op.sequence.v1",
  paymentDetails: "intelly.op.payment-details.v1",
} as const;

export type OrderBackupV1 = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  data: {
    settings: CompanySettings;
    orders: PaymentOrder[];
    sequence: Record<string, number>;
  };
};

export function createOrderBackup(
  settings: CompanySettings,
  orders: PaymentOrder[],
  sequence: Record<string, number>,
  exportedAt = new Date().toISOString(),
): OrderBackupV1;

export function parseOrderBackup(source: string): OrderBackupV1;
```

Validation rules in `parseOrderBackup`:

- Reject invalid JSON with `El archivo no contiene JSON válido.`
- Require `format === BACKUP_FORMAT` and `version === BACKUP_VERSION`; otherwise throw `El respaldo no tiene una versión compatible.`
- Require `exportedAt` to be a valid ISO date string.
- Require every `CompanySettings` string field to be a string and `dueDays` to be a finite positive number.
- Require `orders` to be an array; every order must contain string identity/date/customer fields, boolean `committed` and `invoice`, service type `hosting` or `custom`, discount from 0 through 100, string reason, and at least one structurally valid item for committed orders.
- Require `sequence` to be a plain object whose keys are four-digit years and values are non-negative integers.
- Normalize missing `discountPercent` to `0` and missing `discountReason` to an empty string for backups produced by the pre-discount application.
- Return fresh object and array copies so callers do not retain references to parsed input.

- [ ] **Step 5: Run the backup tests and verify GREEN**

Run: `npm run test:backup`

Expected: all backup tests PASS.

- [ ] **Step 6: Commit the backup format**

```powershell
git add lib/order-backup.ts tests/order-backup.test.ts package.json package-lock.json
git commit -m "feat: add versioned local data backups"
```

---

### Task 3: Add backup export and full restore to the interface

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: `STORAGE_KEYS`, `createOrderBackup`, and `parseOrderBackup` from `lib/order-backup.ts`.
- Produces: `exportBackup()` and `importBackup(file: File)` UI handlers plus a hidden JSON file input.

- [ ] **Step 1: Add failing source-level UI assertions**

Extend the client behavior test in `tests/rendered-html.test.mjs`:

```js
assert.match(page, /Exportar respaldo/);
assert.match(page, /Importar respaldo/);
assert.match(page, /accept="application\/json,\.json"/);
assert.match(page, /parseOrderBackup/);
assert.match(page, /createOrderBackup/);
```

- [ ] **Step 2: Run the existing behavior test and verify RED**

Run: `node --test tests/rendered-html.test.mjs`

Expected: FAIL because the backup controls and imports are absent.

- [ ] **Step 3: Implement export and restore handlers**

In `app/page.tsx`:

- Import `DatabaseBackup`, `Upload`, `useRef`, `STORAGE_KEYS`, `createOrderBackup`, and `parseOrderBackup`.
- Replace the local `STORAGE` constant with `STORAGE_KEYS`.
- Add `const backupInputRef = useRef<HTMLInputElement>(null);`.
- Implement `exportBackup()` to read the sequence from storage, serialize `createOrderBackup(settings, orders, sequence)` with two-space indentation, create an `application/json` Blob, click a temporary download link named `respaldo-ordenes-intelly-YYYY-MM-DD.json`, revoke its URL, and show `Respaldo descargado correctamente.`.
- Implement `importBackup(file)` to read text, call `parseOrderBackup`, and ask:

```ts
window.confirm(
  `El respaldo contiene ${backup.data.orders.length} órdenes y reemplazará los datos guardados en este navegador. ¿Continuar?`,
)
```

- On confirmation, write settings, orders, sequence, and payment-details marker to their exact storage keys; update `settings`, `draftSettings`, `orders`, and `order`; close the settings modal; and show `Respaldo restaurado correctamente.`.
- On any parse or file error, leave storage and React state unchanged and display the thrown validation message or `No fue posible importar el respaldo.`.
- Always clear `event.currentTarget.value` after file selection so the same file can be chosen twice.

- [ ] **Step 4: Add the backup controls to the settings modal**

After the conditions fieldset and before `.modal-footer`, add a `fieldset.backup-panel` containing:

```tsx
<fieldset className="backup-panel">
  <legend><DatabaseBackup size={18} /> Respaldo local</legend>
  <p>Descarga tus ajustes, correlativos e historial para trasladarlos a otro dominio o navegador.</p>
  <div className="backup-actions">
    <button className="button button-outline" type="button" onClick={exportBackup}>
      <Download size={17} /> Exportar respaldo
    </button>
    <button className="button button-outline" type="button" onClick={() => backupInputRef.current?.click()}>
      <Upload size={17} /> Importar respaldo
    </button>
    <input
      ref={backupInputRef}
      className="visually-hidden"
      type="file"
      accept="application/json,.json"
      onChange={handleBackupFile}
    />
  </div>
</fieldset>
```

- [ ] **Step 5: Style desktop and mobile backup controls**

Add `.backup-panel`, `.backup-panel p`, `.backup-actions`, and `.visually-hidden` rules. Use the existing neutral card, border, button, and responsive patterns; switch `.backup-actions` to one column inside the existing mobile breakpoint.

- [ ] **Step 6: Run backup and UI tests**

Run:

```powershell
npm run test:backup
node --test tests/rendered-html.test.mjs
npm run lint
```

Expected: all commands exit `0`.

- [ ] **Step 7: Commit the backup interface**

```powershell
git add app/page.tsx app/globals.css tests/rendered-html.test.mjs
git commit -m "feat: add backup export and restore controls"
```

---

### Task 4: Migrate from Vinext/Cloudflare to standard Next.js

**Files:**
- Create: `tests/deployment-config.test.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `next.config.ts`
- Modify: `tests/rendered-html.test.mjs`
- Delete: `.openai/hosting.json`
- Delete: `vite.config.ts`
- Delete: `build/sites-vite-plugin.ts`
- Delete: `worker/index.ts`
- Delete: `db/index.ts`
- Delete: `db/schema.ts`
- Delete: `drizzle.config.ts`
- Delete: `drizzle/meta/_journal.json`

**Interfaces:**
- Consumes: Existing Next.js `app` directory and public assets.
- Produces: Standard `next dev`, `next build`, and `next start` scripts compatible with Hostinger.

- [ ] **Step 1: Write a failing deployment configuration test**

Create `tests/deployment-config.test.mjs`:

```js
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
  for (const path of [".openai/hosting.json", "vite.config.ts", "worker/index.ts", "build/sites-vite-plugin.ts"]) {
    await assert.rejects(access(new URL(path, root)));
  }
});
```

- [ ] **Step 2: Run the deployment test and verify RED**

Run: `node --test tests/deployment-config.test.mjs`

Expected: FAIL because scripts still use Vinext and Cloudflare files exist.

- [ ] **Step 3: Replace runtime scripts and remove unused packages**

Set exact scripts and engine in `package.json`:

```json
"engines": { "node": "22.x" },
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "test:backup": "tsx --test tests/order-backup.test.ts",
  "test": "npm run build && node --test tests/deployment-config.test.mjs tests/rendered-html.test.mjs && npm run test:backup",
  "pdf:sample": "tsx scripts/generate-sample-pdf.ts",
  "lint": "eslint . --ignore-pattern .next"
}
```

Remove `vinext`, `vite`, `wrangler`, `@cloudflare/vite-plugin`, `@vitejs/plugin-react`, `@vitejs/plugin-rsc`, `react-server-dom-webpack`, `drizzle-orm`, `drizzle-kit`, and the `db:generate` script. Keep Tailwind/PostCSS because `app/globals.css` imports Tailwind. Refresh the lockfile with:

```powershell
npm install --package-lock-only
```

- [ ] **Step 4: Delete Cloudflare and unused database scaffolding**

Delete only the files listed in this task. Preserve `next.config.ts`, setting:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
};

export default nextConfig;
```

- [ ] **Step 5: Replace the worker render test with a production server smoke test**

In `tests/rendered-html.test.mjs`, spawn the local Next binary with Node:

```js
const nextBin = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
const port = 32000 + (process.pid % 1000);
const server = spawn(process.execPath, [nextBin, "start", "-p", String(port)], {
  cwd: fileURLToPath(new URL("../", import.meta.url)),
  stdio: ["ignore", "pipe", "pipe"],
});
```

Poll `http://127.0.0.1:${port}/` for up to 20 seconds, require status `200`, assert the existing metadata and shell content, and stop the child in `finally`. Preserve the source-level behavior assertions in the second test.

- [ ] **Step 6: Run deployment test and verify GREEN**

Run:

```powershell
node --test tests/deployment-config.test.mjs
npm run build
node --test tests/rendered-html.test.mjs
npm run test:backup
```

Expected: standard Next build succeeds and all tests PASS.

- [ ] **Step 7: Commit the runtime migration**

```powershell
git add -A -- package.json package-lock.json next.config.ts tests/deployment-config.test.mjs tests/rendered-html.test.mjs .openai vite.config.ts build worker db drizzle drizzle.config.ts
git commit -m "build: migrate application to standard Next.js"
```

---

### Task 5: Document Hostinger operation and DTE security boundary

**Files:**
- Modify: `README.md`
- Modify: `.gitignore`
- Create: `docs/hostinger-deployment.md`
- Modify: `tests/deployment-config.test.mjs`

**Interfaces:**
- Consumes: Final Next.js scripts from Task 4.
- Produces: Exact operating instructions for GitHub, Hostinger, backups, rollback, and future DTE secrets.

- [ ] **Step 1: Add failing documentation assertions**

Extend `tests/deployment-config.test.mjs`:

```js
test("documents the production deployment without secrets", async () => {
  const guide = await readFile(new URL("docs/hostinger-deployment.md", root), "utf8");
  assert.match(guide, /gestion\.intelly\.cl/);
  assert.match(guide, /Node\.js 22/);
  assert.match(guide, /npm run build/);
  assert.match(guide, /npm run start/);
  assert.match(guide, /ddormz\/intelly-gestor/);
  assert.match(guide, /variables de entorno/i);
});
```

- [ ] **Step 2: Run the documentation test and verify RED**

Run: `node --test tests/deployment-config.test.mjs`

Expected: FAIL because `docs/hostinger-deployment.md` does not exist.

- [ ] **Step 3: Write the deployment guide**

Document these exact production settings:

- Repository: `ddormz/intelly-gestor` (private).
- Branch: `main`.
- Framework: Next.js.
- Node.js: `22.x`.
- Install: `npm ci` when configurable; otherwise Hostinger's lockfile install.
- Build: `npm run build`.
- Start: `npm run start`.
- Domain: `gestion.intelly.cl` with HTTPS.
- Current environment variables: none.
- Future DTE secrets: Hostinger environment variables only; never `NEXT_PUBLIC_*`, Git, browser storage, screenshots, or support messages.
- Data migration: export locally, import online, confirm counts and next correlativo.
- Rollback: revert the failing Git commit on `main`, push, and redeploy the last known-good source.

Update `README.md` with the backup workflow and link to the Hostinger guide. Ensure `.gitignore` covers `.env*`, `.next/`, `node_modules/`, `output/`, `tmp/`, and backup filenames `respaldo-ordenes-intelly-*.json`.

- [ ] **Step 4: Run documentation and secret scans**

Run:

```powershell
node --test tests/deployment-config.test.mjs
git ls-files | rg "(^|/)(\.env|node_modules|\.next|output|tmp)(/|$)|respaldo-ordenes-intelly-.*\.json"
rg -n "(BEGIN (RSA |EC |PRIVATE )?PRIVATE KEY|API[_-]?KEY\s*=|PASSWORD\s*=|TOKEN\s*=)" --glob '!package-lock.json' --glob '!docs/superpowers/**' .
```

Expected: test PASS; both scans return no tracked secret or generated-data matches.

- [ ] **Step 5: Commit operational documentation**

```powershell
git add README.md .gitignore docs/hostinger-deployment.md tests/deployment-config.test.mjs
git commit -m "docs: add Hostinger deployment guide"
```

---

### Task 6: Perform final local release verification

**Files:**
- Verify: entire repository
- Generate: `output/pdf/orden-pago-muestra.pdf` (ignored)
- Generate: `output/pdf/orden-pago-muestra-larga.pdf` (ignored)

**Interfaces:**
- Consumes: Completed application and deployment configuration.
- Produces: Evidence that the exact commit intended for GitHub builds, starts, and retains PDF behavior.

- [ ] **Step 1: Install exactly from the lockfile**

Run:

```powershell
npm ci
```

Expected: installation exits `0` on Node.js 22.

- [ ] **Step 2: Run full automated verification**

Run:

```powershell
npm test
npm run lint
npm run pdf:sample
```

Expected: build, production smoke test, configuration tests, backup tests, lint, and PDF sample all exit `0`.

- [ ] **Step 3: Verify PDF page counts**

Use Poppler `pdfinfo` on both sample files. Expected: compact sample is exactly one page; long sample has only content-bearing pages and no trailing blank page. Render all pages to `tmp/pdfs/` and inspect for clipping or overlap.

- [ ] **Step 4: Verify Git release contents**

Run:

```powershell
git diff --check
git status --short
git ls-files
```

Expected: no uncommitted product changes, no secrets, no dependency folders, no build output, and no JSON backups.

---

### Task 7: Publish the verified main branch to the private GitHub repository

**Files:**
- Modify: local Git remotes only; no source files.

**Interfaces:**
- Consumes: Verified local `main` history.
- Produces: Private GitHub `main` at `https://github.com/ddormz/intelly-gestor`.

- [ ] **Step 1: Verify GitHub access and repository privacy**

Open `https://github.com/ddormz/intelly-gestor` in the authenticated browser. Confirm the signed-in account can write to it and the repository is marked Private. Do not change visibility.

- [ ] **Step 2: Inspect the remote repository before overwriting anything**

Run:

```powershell
git ls-remote https://github.com/ddormz/intelly-gestor.git
```

If the remote has commits not present locally, fetch them and compare histories before pushing. Do not force-push. If it is empty, continue normally.

- [ ] **Step 3: Preserve the current internal remote and add GitHub**

Run:

```powershell
git remote rename origin codex-origin
git remote add origin https://github.com/ddormz/intelly-gestor.git
git remote -v
```

Expected: `origin` is GitHub and `codex-origin` preserves the previous remote.

- [ ] **Step 4: Push without rewriting history**

Run:

```powershell
git push -u origin main
```

Expected: push succeeds without `--force`.

- [ ] **Step 5: Verify GitHub state**

Refresh the repository page. Confirm `main`, the latest release commit, private visibility, README, deployment guide, and absence of generated data.

---

### Task 8: Deploy GitHub main to Hostinger at gestion.intelly.cl

**Files:**
- Modify: Hostinger application settings only; no repository files.

**Interfaces:**
- Consumes: Private GitHub repository and standard Next.js scripts.
- Produces: Live HTTPS application at `https://gestion.intelly.cl`.

- [ ] **Step 1: Create the managed Node.js web app**

In Hostinger hPanel choose **Websites → Add Website → Deploy Web App → Import Git Repository**. Authorize the Hostinger GitHub App for the private `ddormz/intelly-gestor` repository only.

- [ ] **Step 2: Configure the exact deployment**

Select:

```text
Repository: ddormz/intelly-gestor
Branch: main
Framework: Next.js
Node.js: 22.x
Build command: npm run build
Start command: npm run start
Environment variables: none
Domain: gestion.intelly.cl
```

Do not add unused DTE environment variables or expose variables with a
`NEXT_PUBLIC_` prefix.

- [ ] **Step 3: Deploy and inspect logs**

Start the deployment. Require dependency installation, Next.js build, and process start to succeed. If Hostinger reports a failure, preserve the running deployment, capture the exact log, reproduce locally, and commit a tested correction before redeploying.

- [ ] **Step 4: Validate production behavior**

At `https://gestion.intelly.cl`, verify:

- HTTPS and Intelly branding load without mixed-content errors.
- Settings can be saved and persist after reload.
- A Hosting order can be saved and reopened.
- Discount and reason calculate correctly before IVA.
- PDF downloads and the representative two-item order remains one page.
- Backup export downloads JSON.
- An invalid JSON import is rejected without changing current data.

---

### Task 9: Transfer local browser data and complete acceptance

**Files:**
- Generate locally: `respaldo-ordenes-intelly-YYYY-MM-DD.json` (ignored, user-owned).

**Interfaces:**
- Consumes: Localhost `localStorage` and the production backup importer.
- Produces: Production browser storage containing the user's current settings, orders, and correlatives.

- [ ] **Step 1: Export the local backup**

Open the local application, go to **Configuración → Respaldo local → Exportar respaldo**, and retain the downloaded JSON privately.

- [ ] **Step 2: Import into production**

Open `https://gestion.intelly.cl`, choose **Configuración → Respaldo local → Importar respaldo**, select the exported JSON, verify the displayed order count, and confirm replacement.

- [ ] **Step 3: Verify restored state**

Confirm company and bank settings, history count, representative order details, discounts, and the next correlativo. Reload the page and confirm the same values persist.

- [ ] **Step 4: Final release evidence**

Record the deployed URL, GitHub repository URL, production branch, Hostinger deployment status, automated test summary, and backup migration result in the task handoff. Do not include the JSON backup or any private configuration values.
