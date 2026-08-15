# Payment Order POS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the basic order modal with a multi-line POS workflow supporting correct fallback behavior, discounts, editing, public-link rotation, and email delivery.

**Architecture:** Keep the order list server-rendered and introduce focused client state only for the POS cart. Reuse the catalog/client search services from prior phases, but recalculate and persist every monetary value transactionally on the server.

**Tech Stack:** Next.js App Router, React, TypeScript, Drizzle/MySQL, Zod, Nodemailer, jsPDF, Vitest, and Playwright.

**Spec:** `docs/superpowers/specs/2026-08-14-commercial-workflows-and-fiscal-integration-design.md`

## Global Constraints

- Run after the shared UI and catalog/client plans.
- Use integer CLP minor units and deterministic rounding.
- Never trust browser totals, tax, discount, client status, or catalog prices.
- Preserve line snapshots and audit all edits.
- Issued unpaid orders rotate public tokens on financial edits.
- Paid, invoiced, cancelled, and expired orders cannot change financial fields.
- No commit or push during execution.

---

### Task 1: Discount-aware order domain

**Files:**
- Modify: `src/features/orders/domain.ts`
- Modify: `src/lib/money.ts`
- Test: `tests/unit/orders.test.ts`

**Interfaces:**
- Produces `calculateOrder(lines, discountPercent, discountReason)` returning `OrderTotals` and calculated lines.
- Produces `assertEditableOrder(status)` and `assertFinancialEditAllowed(status)`.

- [ ] **Step 1: Write failing domain tests**

Cover empty lines, taxable/exempt lines, 10% discount allocation, zero discount, invalid discount reason, rounding remainder assigned to the last line, and forbidden edits for paid/invoiced orders.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- tests/unit/orders.test.ts`

Expected: FAIL because the current calculator ignores discounts and edit rules.

- [ ] **Step 3: Implement integer CLP calculation**

Calculate each line subtotal, allocate a percentage discount proportionally, adjust the final line by the remainder, calculate tax from discounted taxable bases, and return subtotal, discount, taxable base, exempt base, tax, and total. Reject percentages outside 0-100 and require a non-empty glosa when discount is positive.

- [ ] **Step 4: Run domain tests and typecheck**

Run: `npm test -- tests/unit/orders.test.ts` and `npm run typecheck`.

Expected: PASS.

### Task 2: Order schema, query, and mutation contracts

**Files:**
- Modify: `src/db/schema/index.ts`
- Create: `src/db/migrations/0004_order_pos.sql` via Drizzle generation
- Modify: `src/features/orders/actions.ts`
- Modify: `src/features/orders/service.ts`
- Create: `src/features/orders/validation.ts`
- Modify: `src/features/orders/domain.ts`
- Test: `tests/unit/order-actions.test.ts`

**Interfaces:**
- Produces `createOrderFromCart(input, userId): Promise<string>`.
- Produces `updateOrderFromCart(input, userId, expectedVersion): Promise<void>`.
- Produces `findOrderForEdit(id): Promise<EditableOrder | null>`.
- Consumes `OrderCartLine`, `discountPercent`, `discountReason`, `dueAt`, and `notes`.

- [ ] **Step 1: Write failing mutation tests**

Assert multi-line inserts, server-side price snapshots, client/catalog active checks, discount persistence, version conflict, and status restrictions.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- tests/unit/order-actions.test.ts`

Expected: FAIL because only single-line create exists.

- [ ] **Step 3: Add schema fields and migration**

Add discount percentage/reason fields to `payment_orders` and any order-mail audit or delivery table required by the email contract. Preserve existing `discountTotal`. Generate and inspect the migration.

- [ ] **Step 4: Implement validated cart persistence**

Load the client and each catalog item inside a transaction, verify active status, decide whether submitted prices are allowed for the operator, calculate from normalized values, insert/update header and lines, increment version on update, and write audit metadata without raw secrets.

- [ ] **Step 5: Implement edit-state enforcement**

Allow full financial edits for draft and issued-unpaid. Reject financial edits for paid, invoiced, cancelled, and expired with a stable `ORDER_NOT_EDITABLE` error. For issued edits, revoke the old public token and generate a new one only when the order is reissued or explicitly republished according to the existing public-link flow.

- [ ] **Step 6: Run tests, migration generation, and typecheck**

Run the focused tests, `npm run db:generate`, and `npm run typecheck`.

Expected: PASS and migration contains only order POS changes.

### Task 3: Fix order fallback and list actions

**Files:**
- Modify: `src/app/(dashboard)/ordenes/page.tsx`
- Modify: `src/app/(dashboard)/ordenes/order-manager.tsx`
- Modify: `src/features/clients/service.ts`
- Modify: `src/features/catalog/service.ts`
- Test: `tests/unit/orders.test.ts`
- Test: `tests/rendered-html.test.mjs`

**Interfaces:**
- Orders page receives a reliable `canCreate` result independent of stale fixed-size arrays.
- Orders list uses the shared `PageResult<OrderItem>` contract.

- [ ] **Step 1: Write the regression test**

Assert that the order page does not render “Completa los datos base” when active client and catalog existence checks both return true, even if list pagination has not loaded all records.

- [ ] **Step 2: Run focused test and confirm RED**

Run: `npm test -- tests/unit/orders.test.ts tests/rendered-html.test.mjs`

Expected: FAIL against the current `clients.length > 0 && catalog.length > 0` behavior after stale revalidation.

- [ ] **Step 3: Implement existence checks and revalidation**

Add `hasActiveClient()` and `hasActiveCatalogItem()` queries, use them for creation availability, and revalidate `/ordenes` after client/catalog mutations. Keep selectors bounded for the POS search.

- [ ] **Step 4: Refactor list actions**

Remove the extra table `Card`, add search/filter/pagination controls from the foundation, and convert PDF, issue, payment, edit, and email actions to icon buttons with tooltips.

- [ ] **Step 5: Run tests and typecheck**

Run the focused tests and `npm run typecheck`.

Expected: PASS.

### Task 4: POS pages and cart components

**Files:**
- Create: `src/app/(dashboard)/ordenes/nueva/page.tsx`
- Create: `src/app/(dashboard)/ordenes/nueva/order-pos.tsx`
- Create: `src/app/(dashboard)/ordenes/[id]/editar/page.tsx`
- Create: `src/app/(dashboard)/ordenes/[id]/editar/order-edit.tsx`
- Create: `src/features/orders/search.ts`
- Modify: `src/features/orders/actions.ts`
- Test: `tests/unit/order-pos.test.ts`
- Test: `tests/e2e/order-pos.spec.ts`

**Interfaces:**
- `OrderPos` owns temporary cart state and calls the server action only on submit.
- `searchActiveClients(query)` searches RUT/name; `searchActiveCatalog(query)` searches code/name.

- [ ] **Step 1: Write failing component and E2E scenarios**

Cover client search, quick client return, catalog search, multiple lines, inline price, quantity, discount/glosa, totals, submit, edit, and invalid state messages.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- tests/unit/order-pos.test.ts`

Expected: FAIL because the pages and cart component do not exist.

- [ ] **Step 3: Implement server-backed search**

Use bounded query inputs and deterministic results. Do not preload 500 records into the page.

- [ ] **Step 4: Implement the cart UI**

Render client selector, quick-create link/modal boundary, catalog search, line list, quantity/price fields, remove actions, discount percentage/glosa, and a totals summary. Use icon-only actions with labels/tooltips and keep keyboard access for inline inputs.

- [ ] **Step 5: Implement create/edit submit boundaries**

Serialize only IDs, quantities, normalized prices, discount fields, due date, notes, and expected version. Display server field errors and preserve the cart on failure.

- [ ] **Step 6: Run unit tests, typecheck, and E2E**

Run `npm test -- tests/unit/order-pos.test.ts`, `npm run typecheck`, and `npx playwright test tests/e2e/order-pos.spec.ts` against the isolated test database.

Expected: PASS.

### Task 5: Order email delivery

**Files:**
- Create: `src/features/email/order-email.ts`
- Modify: `src/features/email/mailer.ts`
- Modify: `src/features/orders/actions.ts`
- Create: `src/features/orders/email-service.ts`
- Modify: `src/db/schema/index.ts`
- Test: `tests/unit/order-email.test.ts`

**Interfaces:**
- Produces `sendOrderEmail(orderId, userId): Promise<void>`.
- Reuses `createOrderPdfResponse` data through a binary-producing helper rather than parsing an HTTP response.

- [ ] **Step 1: Write failing mail tests**

Mock Nodemailer and assert recipient, subject, public URL, PDF attachment, missing SMTP error, missing recipient error, and audit outcome.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- tests/unit/order-email.test.ts`

Expected: FAIL because order email templates and service do not exist.

- [ ] **Step 3: Implement safe order email**

Create an HTML/text Spanish template, generate the commercial order PDF bytes server-side, send with configured SMTP, and persist only delivery metadata and outcome. Never store SMTP credentials or raw headers.

- [ ] **Step 4: Add the icon action**

Add a confirmation action that displays the current customer email and invokes the server action. Revalidate the order list after success without changing financial status.

- [ ] **Step 5: Run full POS phase gate**

Run:

```powershell
npm run lint
npm run typecheck
npm test
npx playwright test tests/e2e/order-pos.spec.ts
```

Expected: PASS.
