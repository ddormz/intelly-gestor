# Catalog and Clients Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add project catalog items, formatted CLP input, automatic short codes, client geography, required commercial fields, and IntellyDTE RUT lookup.

**Architecture:** Keep validation and mutations in server modules. Use the shared table/query foundation from the previous plan. Use a server-only IntellyDTE lookup adapter and a local Chilean geography catalog for dependent form selections.

**Tech Stack:** TypeScript, Next.js Server Actions, Drizzle/MySQL, Zod, lucide-react, IntellyDTE `GET /api/v1/rut/{rut}`, Vitest, and Playwright.

**Spec:** `docs/superpowers/specs/2026-08-14-commercial-workflows-and-fiscal-integration-design.md`

## Global Constraints

- Run after `2026-08-14-shared-ui-query-foundation.md`.
- Preserve existing historical catalog codes and client records.
- New catalog codes are generated server-side and are at most 10 characters.
- Existing email validation remains required.
- API keys never reach browser props or client bundles.
- No commit or push during execution.

---

### Task 1: Schema and migration fields

**Files:**
- Modify: `src/db/schema/index.ts`
- Create: `src/db/migrations/0003_catalog_clients.sql` via Drizzle generation
- Modify: `src/db/migrations/meta/_journal.json` and snapshot via Drizzle generation
- Test: `tests/unit/catalog-client-schema.test.ts`

**Interfaces:**
- `catalogItems.type` accepts `product | service | project`.
- `clients.giro` is a nullable string for historical compatibility.
- `clients.region` remains the existing region column and is exposed by projections.

- [ ] **Step 1: Write failing schema tests**

```ts
expect(catalogItems.type).toBeDefined();
expect(clients.giro).toBeDefined();
expect(clients.region).toBeDefined();
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- tests/unit/catalog-client-schema.test.ts`

Expected: FAIL because `project` and `giro` are not represented by the schema.

- [ ] **Step 3: Add schema changes**

Add `project` to the MySQL enum and `giro` to `clients`. Keep existing nullable fields nullable so old rows remain migratable.

- [ ] **Step 4: Generate and inspect migration**

Run: `npm run db:generate`. Inspect the SQL and confirm it alters only the catalog enum and adds `giro`; do not manually delete old rows.

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test -- tests/unit/catalog-client-schema.test.ts` and `npm run typecheck`.

Expected: PASS.

### Task 2: Catalog code generator and CLP normalization

**Files:**
- Create: `src/features/catalog/code.ts`
- Modify: `src/features/catalog/validation.ts`
- Modify: `src/features/catalog/actions.ts`
- Create: `src/components/ui/money-input.tsx`
- Modify: `src/components/ui/index.ts`
- Test: `tests/unit/catalog-code-money.test.ts`

**Interfaces:**
- Produces `generateCatalogCode(name, existingCodes): string`.
- Produces `parseClpInput(value): number`.
- Produces `formatClpInput(value): string`.

- [ ] **Step 1: Write failing tests**

```ts
 expect(generateCatalogCode("Implementación mensual", [])).toBe("IMPLEMENTA");
expect(generateCatalogCode("Proyecto Ágil", ["PROYECTOAG"])).not.toBe("PROYECTOAG");
expect(generateCatalogCode("A", [])).toMatch(/^[A-Z0-9]{2,10}$/);
expect(parseClpInput("$ 1.250.000")).toBe(1250000);
expect(formatClpInput(1250000)).toContain("1.250.000");
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- tests/unit/catalog-code-money.test.ts`

Expected: FAIL because the generator and money helpers do not exist.

- [ ] **Step 3: Implement deterministic generation**

Normalize Unicode with NFD, remove combining marks, uppercase, remove non-alphanumeric characters, take the first 10 characters, and resolve collisions with a bounded numeric suffix while preserving the 10-character maximum. If a name has fewer than two usable characters, use a deterministic `CONCEPTO` prefix plus suffix.

- [ ] **Step 4: Implement MoneyInput**

Render a controlled formatted display and a hidden/normalized integer form value. Reject decimals, negative numbers, and values above the existing domain maximum. Preserve the raw field name expected by server actions.

- [ ] **Step 5: Connect validation and create action**

Remove user-authored code as a required create input. Load existing codes inside the transaction, generate the code, insert, and retry only a unique-code collision with a fresh deterministic suffix. Preserve explicit existing code on update for historical compatibility.

- [ ] **Step 6: Run tests and typecheck**

Run: `npm test -- tests/unit/catalog-code-money.test.ts` and `npm run typecheck`.

Expected: PASS.

### Task 3: Catalog project type and active filters

**Files:**
- Modify: `src/features/catalog/validation.ts`
- Modify: `src/features/catalog/actions.ts`
- Modify: `src/features/catalog/service.ts`
- Modify: `src/features/catalog/csv.ts`
- Modify: `src/app/(dashboard)/productos-servicios/catalog-manager.tsx`
- Modify: `src/app/(dashboard)/productos-servicios/page.tsx`
- Modify: `src/app/api/export/productos-servicios/route.ts`
- Test: `tests/unit/crud-services.test.ts`
- Test: `tests/rendered-html.test.mjs`

**Interfaces:**
- Catalog list consumes the shared page query plus `type` and `tab`.
- Catalog form uses `MoneyInput`, `ComboBox`, and generated read-only code.

- [ ] **Step 1: Write failing catalog tests**

Assert project parsing, active-by-default tab behavior, inactive/all tabs, type filtering, CSV round-trip for project, and absence of a redundant card wrapper.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- tests/unit/crud-services.test.ts tests/rendered-html.test.mjs`

Expected: FAIL because project and tab/query behavior are absent.

- [ ] **Step 3: Update domain and CSV contracts**

Use Spanish labels `Producto`, `Servicio`, `Proyecto`, `Activo`, and `Inactivo` while preserving machine values. Add project to import headers, serializer, template, and export.

- [ ] **Step 4: Refactor catalog manager**

Remove outer `Card`, add `TableToolbar` tabs/filters, replace visible action text with icons/tooltips, and use `ComboBox` for type. Create and edit forms display the generated code read-only and format CLP.

- [ ] **Step 5: Run focused tests and typecheck**

Run the focused tests, then `npm run typecheck`.

Expected: PASS.

### Task 4: Geography catalog and client contract

**Files:**
- Create: `src/features/clients/geography.ts`
- Modify: `src/features/clients/validation.ts`
- Modify: `src/features/clients/csv.ts`
- Modify: `src/features/clients/actions.ts`
- Modify: `src/features/clients/service.ts`
- Modify: `src/app/(dashboard)/clientes/client-manager.tsx`
- Modify: `src/app/api/export/clientes/route.ts`
- Test: `tests/unit/clients-geography.test.ts`

**Interfaces:**
- Produces `listRegions()`, `listCommunes(region)`, and `cityForCommune(region, commune)`.
- Client input includes `giro`, `region`, `commune`, and derived `city`.

- [ ] **Step 1: Write failing geography and validation tests**

```ts
expect(cityForCommune("Región Metropolitana", "Providencia")).toBe("Santiago");
expect(clientSchema.safeParse({ kind: "company", taxId: validRut, legalName: "Empresa", email: "a@b.cl" }).success).toBe(false);
```

Assert address, RUT, and legal name are required while historical nullable records can still be read.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- tests/unit/clients-geography.test.ts`

Expected: FAIL because geography helpers and required address validation are absent.

- [ ] **Step 3: Add the local geography mapping**

Use the existing Chilean geography data available in the local reference repositories as source material, normalize names for lookup, and expose deterministic region/commune/city options. Reject a city that does not match the selected region and commune.

- [ ] **Step 4: Update client actions and CSV**

Persist `giro`, `region`, `commune`, and derived `city`. Add fields to import/export/template and ensure imports validate the same server contract as forms.

- [ ] **Step 5: Refactor client manager**

Remove the outer table card, add active/inactive/all tabs and kind/status filters, use `ComboBox` for kind, add geography selects, and replace row/header action labels with icons/tooltips.

- [ ] **Step 6: Run tests and typecheck**

Run: `npm test -- tests/unit/clients-geography.test.ts` and `npm run typecheck`.

Expected: PASS.

### Task 5: Server-side IntellyDTE RUT lookup

**Files:**
- Modify: `src/features/integrations/intellydte.ts`
- Create: `src/features/clients/rut-lookup.ts`
- Create: `src/app/api/clients/rut/[rut]/route.ts`
- Modify: `src/app/(dashboard)/clientes/client-manager.tsx`
- Modify: `src/lib/env.ts`
- Test: `tests/unit/rut-lookup.test.ts`
- Test: `tests/unit/integration-config.test.ts`

**Interfaces:**
- Produces `lookupClientRut(rut): Promise<{ rut: string; razonSocial: string | null; autorizado: boolean | null }>`.
- Route returns `{ success: true, data }` or Spanish-safe errors without secrets.

- [ ] **Step 1: Write failing adapter and route tests**

Mock `fetch` and assert:

```ts
expect(fetch).toHaveBeenCalledWith(
  "https://dte.example/api/v1/rut/76123456-0",
  expect.objectContaining({ headers: expect.objectContaining({ "x-api-key": "secret" }) }),
);
```

Assert the key never appears in the response body and that 400/502 responses become Spanish-safe client errors.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- tests/unit/rut-lookup.test.ts`

Expected: FAIL because the server route and gateway method do not exist.

- [ ] **Step 3: Implement the server-only lookup**

Normalize and validate the RUT, call `GET {baseUrl}/api/v1/rut/{encodedRut}` with `x-api-key`, use the configured timeout, parse only `data.rut`, `data.razonSocial`, and `data.autorizado`, and return typed errors for invalid/unavailable responses.

- [ ] **Step 4: Add the client UI flow**

Add a lookup icon beside RUT, loading state, success status, error message, and legal-name population. Keep legal name editable and do not submit automatically.

- [ ] **Step 5: Run tests and full phase gate**

Run:

```powershell
npm run lint
npm run typecheck
npm test
```

Expected: PASS.
