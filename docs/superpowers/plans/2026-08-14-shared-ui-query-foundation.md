# Shared UI and Query Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide icon-only actions, accessible tooltips, card-free table surfaces, and reusable server-side list query controls for every management table.

**Architecture:** Keep list reads in Server Components and mutations in Server Actions. Parse URL query state in small server helpers, return typed page results from services, and use focused client components only for interactive controls. `TableShell` remains the table renderer and owns its visual surface.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, lucide-react, Zod, Drizzle ORM, Vitest, and Playwright.

**Spec:** `docs/superpowers/specs/2026-08-14-commercial-workflows-and-fiscal-integration-design.md`

## Global Constraints

- Use icon-only buttons and links with `aria-label`, hover/focus tooltip, and pending/disabled state.
- Keep text in accessible names, headings, confirmations, and status labels.
- Store list state in URL parameters: `page`, `pageSize`, `q`, `status`, `tab`, and module filters.
- Changing search or a filter resets the page to one.
- Do not wrap `TableShell` in a redundant `Card`.
- Preserve the existing responsive/mobile-card table presentation and brand palette.
- Do not commit or push during execution.

---

### Task 1: Typed list query parser

**Files:**
- Create: `src/lib/list-query.ts`
- Test: `tests/unit/list-query.test.ts`

**Interfaces:**
- Produces `PageQuery`, `PageResult<T>`, `parsePageQuery(input)`, and `withPageQuery(base, patch)`.
- Consumes `Record<string, string | string[] | undefined>` from Next `searchParams`.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import { parsePageQuery, withPageQuery } from "@/lib/list-query";

describe("list query", () => {
  it("normalizes invalid values and bounds page size", () => {
    expect(parsePageQuery({ page: "0", pageSize: "999", q: "  cliente " })).toMatchObject({
      page: 1,
      pageSize: 100,
      q: "cliente",
    });
  });

  it("resets page when a search or filter changes", () => {
    expect(withPageQuery({ page: "4", q: "old" }, { q: "new" })).toEqual({ page: "1", q: "new" });
  });
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm test -- tests/unit/list-query.test.ts`

Expected: FAIL because `src/lib/list-query.ts` does not exist.

- [ ] **Step 3: Implement the parser**

Use `page >= 1`, `pageSize` values of 10/25/50/100 with 25 as default, trim and cap search to 120 characters, and collapse duplicate array parameters to their first value. Return only validated values.

- [ ] **Step 4: Run the focused test and typecheck**

Run: `npm test -- tests/unit/list-query.test.ts`

Then run: `npm run typecheck`

Expected: PASS.

### Task 2: Icon actions and tooltip foundation

**Files:**
- Create: `src/components/ui/icon-button.tsx`
- Create: `src/components/ui/combo-box.tsx`
- Modify: `src/components/ui/index.ts`
- Modify: `src/components/ui/primitives.tsx`
- Modify: `src/app/globals.css`
- Test: `tests/unit/management-ui.test.ts`

**Interfaces:**
- Produces `IconButton({ label, icon, href, variant, pending, ...props })`.
- Produces `ComboBox({ name, label, options, value, onChange, required })` with keyboard navigation, filtering, and a hidden form value.
- Produces a focusable tooltip style shared by button and link variants.

- [ ] **Step 1: Extend the failing UI test**

Assert that rendered source for `IconButton` contains the label in `aria-label`, a tooltip attribute or tooltip element, and a visually-hidden accessible name. Assert that `TableShell` owns the surface class and does not add a nested card wrapper.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm test -- tests/unit/management-ui.test.ts`

Expected: FAIL because `IconButton` and the tooltip styles do not exist.

- [ ] **Step 3: Implement the smallest accessible component**

Render a `button` when no `href` is supplied and a Next `Link` when `href` is supplied. Require a non-empty `label`; set `aria-label={label}` and a tooltip visible on `:hover` and `:focus-visible`. Do not use hover as the only accessible label. Preserve the existing button variants.

- [ ] **Step 4: Implement the shared ComboBox**

Render an input-backed listbox with `role="combobox"`, `aria-expanded`, `aria-controls`, active-option state, ArrowUp/ArrowDown/Enter/Escape handling, and a hidden input named with the selected value. Do not submit the display search text as the domain value.

- [ ] **Step 5: Update the table surface**

Keep `TableShell` as the only table surface. Add border, radius, background, and overflow styles to `.data-table-wrap` in `globals.css`; do not make `TableShell` render a `Card` component.

- [ ] **Step 6: Run focused tests and lint**

Run: `npm test -- tests/unit/management-ui.test.ts`

Then run: `npm run lint`

Expected: PASS.

### Task 3: Toolbar, tabs, and pagination

**Files:**
- Create: `src/components/ui/table-toolbar.tsx`
- Create: `src/components/ui/pagination.tsx`
- Modify: `src/components/ui/index.ts`
- Modify: `src/app/globals.css`
- Test: `tests/unit/table-controls.test.ts`

**Interfaces:**
- Produces `TableToolbar({ query, filters, tabs, action })`.
- Produces `Pagination({ page, pageSize, total, query })`.
- Both produce links/forms that preserve unrelated URL parameters and reset page on changes.

- [ ] **Step 1: Write failing control tests**

Test that the search form preserves `status`, a filter link sets `page=1`, the active tab is exposed with `aria-selected`, and pagination disables previous/next at boundaries.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- tests/unit/table-controls.test.ts`

Expected: FAIL because the controls do not exist.

- [ ] **Step 3: Implement URL-preserving controls**

Use `URLSearchParams` from the current query, remove empty values, and create links with `page=1` for search/filter/tab changes. Use accessible labels in Spanish and focusable tooltips for icon-only reset/submit controls.

- [ ] **Step 4: Add responsive styles**

Make toolbar controls wrap on mobile, keep filters readable, and ensure pagination is keyboard navigable without horizontal overflow.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `npm test -- tests/unit/table-controls.test.ts`

Then run: `npm run typecheck`

Expected: PASS.

### Task 4: Convert shared shell actions to icons

**Files:**
- Modify: `src/components/layout/app-shell.tsx`
- Modify: `src/components/ui/submit-button.tsx`
- Test: `tests/unit/management-ui.test.ts`

**Interfaces:**
- Consumes `IconButton` and existing `SubmitButton` pending behavior.
- Preserves `logoutAction` and sidebar navigation semantics.

- [ ] **Step 1: Add failing assertions**

Assert that logout renders `LogOut`, an accessible Spanish label, and no visible “Cerrar sesión” text in the action button. Assert that collapsed and mobile navigation retain labels for assistive technology.

- [ ] **Step 2: Run focused test and confirm RED**

Run: `npm test -- tests/unit/management-ui.test.ts`

Expected: FAIL because the logout action still renders visible text.

- [ ] **Step 3: Refactor logout and shell controls**

Use an icon-only logout control with tooltip and preserve pending state. Keep menu, close, sidebar-collapse, and navigation labels accessible. Do not remove the visible user identity panel.

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test -- tests/unit/management-ui.test.ts`

Then run: `npm run typecheck`

Expected: PASS.

### Task 5: Migrate management list services and pages

**Files:**
- Modify: `src/features/auth/admin-service.ts`
- Modify: `src/features/clients/service.ts`
- Modify: `src/features/catalog/service.ts`
- Modify: `src/features/orders/service.ts`
- Modify: `src/features/billing/service.ts`
- Modify: `src/features/audit/service.ts`
- Modify: `src/app/(dashboard)/usuarios/page.tsx`
- Modify: `src/app/(dashboard)/clientes/page.tsx`
- Modify: `src/app/(dashboard)/productos-servicios/page.tsx`
- Modify: `src/app/(dashboard)/ordenes/page.tsx`
- Modify: `src/app/(dashboard)/facturacion/page.tsx`
- Modify: `src/app/(dashboard)/integraciones/page.tsx`
- Modify: `src/app/(dashboard)/integraciones/usuarios/page.tsx`
- Modify: `src/app/(dashboard)/integraciones/integration-manager.tsx`
- Modify: `src/app/(dashboard)/clientes/client-manager.tsx`
- Modify: `src/app/(dashboard)/productos-servicios/catalog-manager.tsx`
- Modify: `src/app/(dashboard)/ordenes/order-manager.tsx`
- Modify: `src/app/(dashboard)/facturacion/billing-manager.tsx`
- Modify: `src/app/(dashboard)/usuarios/user-manager.tsx`
- Test: `tests/unit/management-ui.test.ts`
- Test: `tests/unit/list-services.test.ts`

**Interfaces:**
- Every interactive list service consumes `PageQuery` plus module filters and returns `PageResult<T>`.
- Every page passes URL state to its manager and renders `TableToolbar` and `Pagination`.

- [ ] **Step 1: Add failing service tests per module**

Use mocked Drizzle adapters or service dependency seams to assert a search/filter query produces a bounded page result and deterministic ordering. Include users, clients, catalog, orders, invoices, and integration attempts.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- tests/unit/list-services.test.ts`

Expected: FAIL because services still return arrays with fixed limits.

- [ ] **Step 3: Implement service query contracts**

Add count plus page query for each module. Keep active selector helpers for orders separate from paginated management lists. Use `asc(name)` or `desc(createdAt)` plus ID tie-breakers.

- [ ] **Step 4: Refactor each page without outer table cards**

Pass `searchParams` into the page, parse through `parsePageQuery`, and render toolbar, table shell, empty state, and pagination. Convert header/import/export/template and row actions to `IconButton`; keep confirmations and action-state errors.

- [ ] **Step 5: Add filter-specific controls**

Use status tabs and module filters where later plans require them. For users and integrations, include search, status/result filters, and pagination even if no active/inactive tabs are needed.

- [ ] **Step 6: Run full foundation verification**

Run:

```powershell
npm run lint
npm run typecheck
npm test
```

Expected: PASS with no redundant table card regressions.
