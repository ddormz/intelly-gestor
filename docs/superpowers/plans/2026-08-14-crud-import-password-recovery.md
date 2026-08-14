# CRUD, CSV and Password Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Intelly Gestor's modal CRUD experience, safe CSV interchange, encrypted IntellyDTE configuration, and Hostinger SMTP password recovery without changing financial calculations or the payment-order PDF.

**Architecture:** Keep reads in Server Components and mutations in Server Actions. Add small client boundaries for dialogs, action-state forms, file selection, and the collapsible sidebar; keep validation, authorization, encryption, CSV processing, mail delivery, and database writes in focused server modules. Ship the related schema changes through the existing Drizzle startup bootstrap.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript, Drizzle ORM/MySQL, Zod, Argon2id, Node crypto AES-256-GCM, Nodemailer, csv-parse/csv-stringify, Vitest, Oxlint.

## Global Constraints

- Preserve Server Components and Server Actions as the primary architecture.
- Keep the application light-only and preserve the approved Intelly cyan/blue visual system.
- Do not change financial calculations, public routes, MySQL contracts, or the payment-order PDF layout.
- A modal must not close from an outside click; `X`, Cancel, and `Escape` remain available unless submission is pending.
- Desactivation is logical; related records are never physically deleted.
- CSV is UTF-8 with BOM, Excel-compatible, atomic on import, and protected against spreadsheet formula injection.
- Orders import only new drafts; billing import only historical issued documents linked to paid orders.
- API keys and SMTP secrets must never reach client props, logs, CSV, or audit metadata.
- Password-reset tokens expire after 30 minutes, are single-use, and are stored only as SHA-256 hashes.
- `CREDENTIALS_ENCRYPTION_KEY` is exactly 32 random bytes encoded as base64.

---

### Task 1: Dependencies, schema, environment, and migration

**Files:**
- Modify: `package.json`
- Modify: `src/lib/env.ts`
- Modify: `src/db/schema/index.ts`
- Create: `src/db/migrations/0001_secure_management.sql` via Drizzle generation
- Modify: `src/db/migrations/meta/_journal.json` via Drizzle generation
- Test: `tests/unit/env-security.test.ts`
- Modify: `.env.example`
- Modify: `docs/hostinger-deployment.md`

**Interfaces:**
- Produces: `integrationConfigs`, `passwordResetTokens`, and `passwordResetRequests` Drizzle tables.
- Produces: `AppEnv` fields `APP_URL`, `CREDENTIALS_ENCRYPTION_KEY`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`.

- [ ] **Step 1: Read the local Next.js guides before changing application code**

Run:

```powershell
Get-Content -Raw node_modules/next/dist/docs/01-app/03-building-your-application/02-data-fetching/03-server-actions-and-mutations.mdx
Get-Content -Raw node_modules/next/dist/docs/01-app/03-building-your-application/01-routing/13-route-handlers.mdx
```

Expected: both files describe the installed Next.js 16.3 APIs. If paths differ, locate the matching files with `rg --files node_modules/next/dist/docs | rg 'server-actions|route-handlers'` and read them completely.

- [ ] **Step 2: Write failing environment and schema tests**

Create tests that import the schema and assert the security-sensitive fields exist, and that a helper parsing a complete environment accepts a 32-byte base64 key while rejecting a short one:

```ts
expect(integrationConfigs.apiKeyCiphertext).toBeDefined();
expect(passwordResetTokens.tokenHash).toBeDefined();
expect(passwordResetRequests.ipHash).toBeDefined();
expect(parseAppEnv(completeEnv).SMTP_PORT).toBe(465);
expect(() => parseAppEnv({ ...completeEnv, CREDENTIALS_ENCRYPTION_KEY: "short" })).toThrow();
```

- [ ] **Step 3: Run the focused test and confirm RED**

Run: `npm test -- tests/unit/env-security.test.ts`

Expected: FAIL because the exports and tables do not exist.

- [ ] **Step 4: Add dependencies and schema**

Run: `npm install nodemailer csv-parse csv-stringify`

Then run: `npm install -D @types/nodemailer`

Add tables with these stable columns:

```ts
export const integrationConfigs = mysqlTable("integration_configs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  integration: varchar("integration", { length: 50 }).notNull(),
  baseUrl: varchar("base_url", { length: 500 }).notNull(),
  apiKeyCiphertext: text("api_key_ciphertext").notNull(),
  apiKeyIv: varchar("api_key_iv", { length: 32 }).notNull(),
  apiKeyAuthTag: varchar("api_key_auth_tag", { length: 32 }).notNull(),
  apiKeyLastFour: varchar("api_key_last_four", { length: 4 }).notNull(),
  status: mysqlEnum("status", ["active", "disabled"]).notNull().default("active"),
  updatedBy: varchar("updated_by", { length: 36 }).notNull().references(() => users.id),
  ...timestamps,
}, (table) => [uniqueIndex("integration_configs_name_uq").on(table.integration)]);
```

Define `password_reset_tokens` with `id`, `userId`, unique `tokenHash`, `expiresAt`, nullable `usedAt`, `requestedIpHash`, and `createdAt`. Define `password_reset_requests` with `id`, `emailHash`, `ipHash`, and `createdAt`, indexed by email/time and IP/time.

- [ ] **Step 5: Export a testable environment parser**

Refactor `src/lib/env.ts` to export:

```ts
export function parseAppEnv(input: Record<string, string | undefined>): AppEnv {
  return envSchema.parse(input);
}
```

Validate the decoded encryption key length with a Zod refinement, and make SMTP fields optional as a group in development but required when password recovery sends mail.

- [ ] **Step 6: Generate the migration and update deployment documentation**

Run: `npm run db:generate`

Document exact Hostinger variable names and clarify that startup bootstrap applies the migration automatically. Add safe example values to `.env.example` without real secrets.

- [ ] **Step 7: Run tests and commit**

Run: `npm test -- tests/unit/env-security.test.ts`

Then run: `npm run typecheck`

Expected: PASS.

Commit: `feat: add secure management schema and environment`

---

### Task 2: Accessible modal foundation and collapsible shell

**Files:**
- Create: `src/components/ui/modal.tsx`
- Create: `src/components/ui/modal-form.tsx`
- Modify: `src/components/ui/index.ts`
- Modify: `src/components/ui/primitives.tsx`
- Modify: `src/components/layout/app-shell.tsx`
- Modify: `src/app/globals.css`
- Test: `tests/unit/management-ui.test.tsx`

**Interfaces:**
- Produces: `Modal({ open, onClose, title, description, pending, children })`.
- Produces: `ModalTrigger` wrappers owned by each module client component.
- Consumes: `ActionState` and existing button variants.

- [ ] **Step 1: Write failing component tests**

Render the shell and modal to assert:

```ts
expect(markup).toContain('aria-label="Colapsar navegación"');
expect(markup).toContain('href="/usuarios"');
expect(markup).not.toContain("Operación segura");
expect(modalMarkup).toContain('aria-modal="true"');
```

Add a DOM test that dispatches a pointer event to the dialog backdrop and verifies `onClose` is not called.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm test -- tests/unit/management-ui.test.tsx`

Expected: FAIL because the modal and toggle do not exist.

- [ ] **Step 3: Implement the modal boundary**

Use `HTMLDialogElement.showModal()`, `cancel` handling, focus restoration, `aria-labelledby`, and an explicit close button. Prevent `click` events whose target is the dialog itself from closing it. Block close controls and `cancel` while `pending` is true.

- [ ] **Step 4: Refactor the shell**

Add `/usuarios` for admins, remove the integrations/users coupling, remove the safe badge, use a compact icon logout action, and persist `intelly-sidebar-collapsed` only after mount. Render icon labels visually hidden in collapsed mode and expose a tooltip through `title` plus accessible link text.

- [ ] **Step 5: Add shell/modal styles**

Add 260/76 px CSS variables, white sidebar transitions, cyan active state, dialog backdrop, responsive modal sizing, and reduced-motion behavior. Keep the mobile drawer behavior unchanged.

- [ ] **Step 6: Run tests and commit**

Run: `npm test -- tests/unit/management-ui.test.tsx`

Then run: `npm run lint`

Then run: `npm run typecheck`

Expected: PASS.

Commit: `feat: add modal workflows and collapsible navigation`

---

### Task 3: Client and catalog modal CRUD

**Files:**
- Modify: `src/features/clients/validation.ts`
- Modify: `src/features/clients/actions.ts`
- Modify: `src/features/clients/service.ts`
- Create: `src/app/(dashboard)/clientes/client-manager.tsx`
- Modify: `src/app/(dashboard)/clientes/page.tsx`
- Modify: `src/features/catalog/validation.ts`
- Modify: `src/features/catalog/actions.ts`
- Modify: `src/features/catalog/service.ts`
- Create: `src/app/(dashboard)/productos-servicios/catalog-manager.tsx`
- Modify: `src/app/(dashboard)/productos-servicios/page.tsx`
- Test: `tests/unit/crud-services.test.ts`

**Interfaces:**
- Produces: `updateClientAction`, `setClientStatusAction`, `updateCatalogItemAction`, `setCatalogItemStatusAction` returning `ActionState`.
- Produces: list queries that include active and inactive records.

- [ ] **Step 1: Write failing service and validation tests**

Test that update payloads require UUIDs, that status accepts only `active|inactive`, and that inactive entities are rejected by order creation selectors:

```ts
expect(clientUpdateSchema.safeParse({ id: "bad" }).success).toBe(false);
expect(statusSchema.parse({ id: validId, status: "inactive" }).status).toBe("inactive");
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- tests/unit/crud-services.test.ts`

Expected: FAIL because schemas/actions are absent.

- [ ] **Step 3: Implement transactional actions**

Each action must call `enforceSameOrigin()`, `requireUser()`, parse Zod input, update by ID, write an audit event, and revalidate its module plus `/ordenes`. Return known validation failures as `ActionState` and never leak SQL errors.

- [ ] **Step 4: Build module managers**

Move create forms into client managers, add edit and deactivate/reactivate buttons per row, and use the shared modal. Supply guided placeholders such as `76.123.456-7`, `facturacion@empresa.cl`, `+56 9 1234 5678`, `SERV-001`, `Implementación mensual`, and `150000`.

- [ ] **Step 5: Keep lists full-width and expose status**

Remove side-by-side `FormPanel` layouts. Display status badges and prevent inactive records from appearing in new-order selectors by filtering in `listActiveClients()` and `listActiveCatalogItems()`.

- [ ] **Step 6: Run tests and commit**

Run: `npm test -- tests/unit/crud-services.test.ts`

Then run: `npm run lint`

Then run: `npm run typecheck`

Expected: PASS.

Commit: `feat: complete client and catalog modal CRUD`

---

### Task 4: Shared safe CSV engine and client/catalog interchange

**Files:**
- Create: `src/lib/csv.ts`
- Create: `src/components/import-export/import-modal.tsx`
- Create: `src/features/clients/csv.ts`
- Create: `src/features/catalog/csv.ts`
- Create: `src/app/api/export/clientes/route.ts`
- Create: `src/app/api/export/productos-servicios/route.ts`
- Modify: `src/features/clients/actions.ts`
- Modify: `src/features/catalog/actions.ts`
- Modify: both module manager components
- Test: `tests/unit/csv.test.ts`

**Interfaces:**
- Produces: `escapeSpreadsheetCell(value: string): string`.
- Produces: `serializeCsv(headers, rows): string` with UTF-8 BOM.
- Produces: `parseCsvUpload(file, schema, limits): Promise<ParsedRows>` with row-numbered errors.
- Produces: module-specific `importClientsAction` and `importCatalogAction`.

- [ ] **Step 1: Write failing CSV security tests**

Cover quoted commas, Chilean characters, BOM, maximum file/row limits, all-or-nothing row errors, and formula prefixes:

```ts
expect(escapeSpreadsheetCell("=HYPERLINK(\"x\")")).toBe("'=HYPERLINK(\"x\")");
expect(serializeCsv(["nombre"], [["Ñandú"]]).startsWith("\uFEFF")).toBe(true);
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- tests/unit/csv.test.ts`

Expected: FAIL because the CSV module does not exist.

- [ ] **Step 3: Implement the shared parser/serializer**

Use `csv-parse/sync` and `csv-stringify/sync`, cap uploads at 2 MiB and 5,000 rows, normalize BOM/header whitespace, and return `{ row, field, message }[]` without writing data.

- [ ] **Step 4: Implement module mappings and atomic imports**

Clients match RUT then email; catalog matches code. Validate every row, then use one Drizzle transaction to insert/update. Do not reactivate inactive matches. Write one summary audit event with counts only.

- [ ] **Step 5: Add authenticated export routes and UI controls**

Route handlers call `requireUser()`, set `Content-Type: text/csv; charset=utf-8` and safe attachment filenames. Add Importar, Exportar, and Descargar plantilla controls to each module header.

- [ ] **Step 6: Run tests and commit**

Run: `npm test -- tests/unit/csv.test.ts`

Then run: `npm run lint`

Then run: `npm run typecheck`

Expected: PASS.

Commit: `feat: add safe client and catalog CSV interchange`

---

### Task 5: Orders and billing modals plus constrained CSV

**Files:**
- Create: `src/app/(dashboard)/ordenes/order-manager.tsx`
- Modify: `src/app/(dashboard)/ordenes/page.tsx`
- Modify: `src/features/orders/actions.ts`
- Modify: `src/features/orders/service.ts`
- Create: `src/features/orders/csv.ts`
- Create: `src/app/api/export/ordenes/route.ts`
- Create: `src/app/(dashboard)/facturacion/billing-manager.tsx`
- Modify: `src/app/(dashboard)/facturacion/page.tsx`
- Modify: `src/features/billing/actions.ts`
- Modify: `src/features/billing/service.ts`
- Create: `src/features/billing/csv.ts`
- Create: `src/app/api/export/facturacion/route.ts`
- Test: `tests/unit/financial-imports.test.ts`

**Interfaces:**
- Produces: `importDraftOrdersAction` and `importHistoricalInvoicesAction`.
- Consumes: shared modal, CSV engine, active client/catalog queries, existing domain transition functions.

- [ ] **Step 1: Write failing financial import tests**

Assert that order imports reject unknown/inactive RUTs, unknown/inactive catalog codes, non-positive quantities, and existing order numbers. Assert that invoice imports require a paid order, folio, external ID, and no existing invoice.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- tests/unit/financial-imports.test.ts`

Expected: FAIL because import policies are absent.

- [ ] **Step 3: Implement order import policy**

Map `rut_cliente,codigo,cantidad` to calls that use the existing `createOrder` calculation path inside a transaction. Create only drafts and write audit summaries without changing numbering or totals logic.

- [ ] **Step 4: Implement historical invoice import policy**

Map `numero_orden,folio,id_externo,fecha_emision` to issued invoice rows only when the order is paid. Atomically insert the invoice and transition the order to `invoiced`; never call the gateway and never overwrite.

- [ ] **Step 5: Move operations into modal flows**

Open order creation from the header. Wrap Emitir, Registrar pago, and Emitir factura in non-backdrop-dismissable confirmation dialogs. Preserve the public-link redirect and idempotency keys.

- [ ] **Step 6: Add export/template routes and controls**

Export safe operational fields only. Add Importar, Exportar, and template actions to Orders and Billing; label historical billing import explicitly.

- [ ] **Step 7: Run tests and commit**

Run: `npm test -- tests/unit/financial-imports.test.ts tests/unit/orders.test.ts`

Then run: `npm run lint`

Then run: `npm run typecheck`

Expected: PASS.

Commit: `feat: add modal financial workflows and constrained CSV`

---

### Task 6: Independent Users module and user CSV

**Files:**
- Create: `src/app/(dashboard)/usuarios/page.tsx`
- Create: `src/app/(dashboard)/usuarios/user-manager.tsx`
- Modify: `src/app/(dashboard)/integraciones/usuarios/page.tsx`
- Modify: `src/features/auth/admin-actions.ts`
- Create: `src/features/auth/admin-service.ts`
- Create: `src/features/auth/users-csv.ts`
- Create: `src/app/api/export/usuarios/route.ts`
- Test: `tests/unit/user-management.test.ts`

**Interfaces:**
- Produces: `updateUserAction`, `setUserStatusAction`, and `importUsersAction`.
- Produces: `listUsersForAdmin()` with no password/session secrets.

- [ ] **Step 1: Write failing authorization and self-protection tests**

Test admin-only access, unique normalized email, update name/role, rejection of self-deactivation, and session revocation when another user is disabled.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- tests/unit/user-management.test.ts`

Expected: FAIL because the service and actions do not exist.

- [ ] **Step 3: Implement user service/actions**

Keep hashes out of query results. Use transactions for status changes and session revocation. Revalidate `/usuarios` and audit create/update/status operations.

- [ ] **Step 4: Build the independent module**

Move Users to `/usuarios`, redirect `/integraciones/usuarios` using `redirect('/usuarios')`, remove the Integrations page button, and create modal forms with placeholders `María González`, `maria@intelly.cl`, and a generated-password hint.

- [ ] **Step 5: Add user CSV**

Import `nombre,correo,rol,estado,contrasena_temporal`; require a valid temporary password only for new users, never export passwords, hashes, tokens, or session data. Match by email and never reactivate automatically.

- [ ] **Step 6: Run tests and commit**

Run: `npm test -- tests/unit/user-management.test.ts tests/unit/csv.test.ts`

Then run: `npm run lint`

Then run: `npm run typecheck`

Expected: PASS.

Commit: `feat: separate and complete user management`

---

### Task 7: Encrypted IntellyDTE configuration

**Files:**
- Create: `src/lib/encryption.ts`
- Create: `src/features/integrations/config-service.ts`
- Create: `src/features/integrations/actions.ts`
- Create: `src/app/(dashboard)/integraciones/integration-manager.tsx`
- Modify: `src/app/(dashboard)/integraciones/page.tsx`
- Modify: `src/features/integrations/intellydte.ts`
- Create: `src/app/api/export/integraciones/route.ts`
- Test: `tests/unit/integration-config.test.ts`

**Interfaces:**
- Produces: `encryptSecret(plaintext, key): EncryptedSecret` and `decryptSecret(secret, key): string`.
- Produces: `getIntellyDteConfig(): Promise<{ baseUrl: string; apiKey: string } | null>` server-only.
- Produces: `saveIntellyDteConfigAction` and `testIntellyDteConfigAction` returning `ActionState`.

- [ ] **Step 1: Write failing encryption/config tests**

Test AES-GCM round-trip, unique IVs, tamper rejection, masked output, admin authorization, and absence of plaintext in persisted/audit values.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- tests/unit/integration-config.test.ts`

Expected: FAIL because encryption and config services are absent.

- [ ] **Step 3: Implement authenticated encryption**

Decode the 32-byte base64 key, create a 12-byte IV, use `aes-256-gcm`, encode ciphertext/IV/tag as base64, and throw a safe configuration error on authentication failure.

- [ ] **Step 4: Implement configuration persistence**

Upsert the singleton `intellydte` row, retaining the existing API key when the modal submits a blank replacement. Return only `{ baseUrl, configured, apiKeyMask, updatedAt }` to UI. Audit only base URL, actor, and configuration status.

- [ ] **Step 5: Implement fail-closed gateway configuration**

Load stored credentials first and environment credentials second. Because no official public IntellyDTE API contract is available, do not invent invoice endpoints: keep fake mode for tests and make HTTP mode report `CONTRACT_REQUIRED` after validating URL reachability/auth setup. Isolate the future official adapter behind `IntellyDteGateway`.

- [ ] **Step 6: Add modal and history export**

Add Base URL placeholder `https://api.intellydte.cl`, masked API key replacement, Guardar and Probar conexión actions, plus CSV export for sanitized integration-attempt history.

- [ ] **Step 7: Run tests and commit**

Run: `npm test -- tests/unit/integration-config.test.ts tests/unit/clients-integrations.test.ts`

Then run: `npm run lint`

Then run: `npm run typecheck`

Expected: PASS.

Commit: `feat: secure IntellyDTE configuration`

---

### Task 8: Hostinger SMTP password recovery

**Files:**
- Create: `src/features/auth/password-reset.ts`
- Create: `src/features/auth/password-reset-actions.ts`
- Create: `src/features/email/mailer.ts`
- Create: `src/features/email/password-reset-email.ts`
- Create: `src/app/(auth)/recuperar-contrasena/page.tsx`
- Create: `src/app/(auth)/recuperar-contrasena/recovery-form.tsx`
- Create: `src/app/(auth)/restablecer-contrasena/page.tsx`
- Create: `src/app/(auth)/restablecer-contrasena/reset-form.tsx`
- Modify: `src/app/(auth)/login/login-form.tsx`
- Modify: `src/features/auth/admin-actions.ts`
- Test: `tests/unit/password-recovery.test.ts`

**Interfaces:**
- Produces: `requestPasswordReset(email, ip): Promise<void>` with neutral observable behavior.
- Produces: `consumePasswordReset(token, password): Promise<void>`.
- Produces: `sendPasswordResetEmail({ to, resetUrl, expiresMinutes }): Promise<void>`.
- Produces: `requestPasswordResetAction` and `resetPasswordAction` returning `ActionState`.

- [ ] **Step 1: Write failing security-flow tests**

Cover identical response for known/unknown email, SHA-256 storage, 30-minute expiry, single use, invalidation of older tokens, per-email/IP throttling, password confirmation, account unlock, and revocation of every session.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- tests/unit/password-recovery.test.ts`

Expected: FAIL because the recovery flow is absent.

- [ ] **Step 3: Implement token lifecycle**

Generate 32 random bytes, return base64url only for email composition, store `hashToken(token)`, expire at `now + 30 minutes`, invalidate older unused tokens, and write a request row for every normalized email/IP before applying rate limits.

- [ ] **Step 4: Implement SMTP delivery**

Create Nodemailer transport with TLS implicit for port 465 and STARTTLS for 587. Render a concise branded HTML/text message. Build the reset URL with `new URL('/restablecer-contrasena', APP_URL)` and never log token or SMTP failure details.

- [ ] **Step 5: Implement token consumption transaction**

Lock/read the valid unused token, hash the new password with Argon2id, mark the token used, update `passwordChangedAt`, reset `failedLoginCount` and `lockedUntil`, revoke sessions, invalidate sibling tokens, and audit the completed reset.

- [ ] **Step 6: Build public forms and admin send action**

Add `¿Olvidaste tu contraseña?` to login. Use neutral success copy on recovery. Validate repeated password on reset. In Users, add `Enviar recuperación` for active accounts without displaying whether mail delivery succeeded beyond a safe action message.

- [ ] **Step 7: Run tests and commit**

Run: `npm test -- tests/unit/password-recovery.test.ts tests/unit/auth.test.ts`

Then run: `npm run lint`

Then run: `npm run typecheck`

Expected: PASS.

Commit: `feat: add secure Hostinger password recovery`

---

### Task 9: Integration verification, accessibility, and production readiness

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `tests/deployment-config.test.mjs`
- Create: `tests/e2e/management.spec.ts`
- Modify: `README.md` if present, otherwise `docs/hostinger-deployment.md`

**Interfaces:**
- Consumes all previous task outputs.
- Produces a deployable build and operator configuration checklist.

- [ ] **Step 1: Add regression assertions**

Assert existing public order/PDF contracts remain unchanged, new routes are present, production dependency installation contains Nodemailer/CSV packages, and the old `/integraciones/usuarios` route redirects.

- [ ] **Step 2: Add browser acceptance coverage**

Cover modal backdrop behavior, create/edit/deactivate flows, sidebar expanded/collapsed states, keyboard focus, role-filtered Users navigation, CSV download headers, and password-recovery neutral response using mocked mail delivery.

- [ ] **Step 3: Run the complete verification suite**

Run sequentially:

```powershell
npm run lint
npm run typecheck
npm test
npm run test:legacy-render
npm run build
```

Expected: all commands exit 0; build lists `/usuarios`, `/recuperar-contrasena`, `/restablecer-contrasena`, and CSV export routes.

- [ ] **Step 4: Review security and visual acceptance manually**

At 1440, 1024, 768, and 375 px verify white sidebar, cyan active state, 76 px collapsed rail, readable tooltips, no “Operación segura” badge, compact logout, guided placeholders, focus containment, no backdrop dismissal, and no secrets in HTML/network responses.

- [ ] **Step 5: Confirm migration/bootstrap and document operator actions**

Verify a clean database applies `0001_secure_management.sql` through `npm run build`/startup bootstrap. Document exact Hostinger variables, encryption-key generation instructions, SMTP 465/587 choice, and a smoke test that sends one reset email.

- [ ] **Step 6: Commit final verification changes**

Commit: `test: verify management and recovery workflows`

- [ ] **Step 7: Request review and integrate**

Use `superpowers:requesting-code-review`, resolve findings, re-run the complete suite, then use `superpowers:finishing-a-development-branch` to push the branch and open a pull request toward `main`. Merge only after checks pass.
