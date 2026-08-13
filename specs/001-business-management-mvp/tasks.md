# Tasks: Intelly Gestor MVP

**Input**: Design documents from `specs/001-business-management-mvp/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Required by the project constitution and feature success criteria. Write each listed test
before its corresponding implementation and observe the intended failure.

**Organization**: Tasks are grouped by user story and follow `[ID] [P?] [Story?] Description`.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the single deployable project and repeatable local environment.

- [x] T001 Initialize the Next.js TypeScript application and scripts in package.json
- [x] T002 [P] Configure Oxlint, typecheck, Vitest, Testing Library, and Playwright in package.json, vitest.config.ts, and playwright.config.ts
- [x] T003 [P] Define secret-safe environment validation and examples in src/lib/env.ts and .env.example
- [x] T004 [P] Add local MySQL service and health check in compose.yaml
- [x] T005 [P] Add project usage and security setup guidance in README.md
- [x] T006 [P] Translate the persisted design system into semantic web tokens in src/app/globals.css

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Persistence, shared security, UI primitives, and error/audit conventions needed by every story.

- [x] T007 Define Drizzle MySQL schemas, relations, indexes, and enums in src/db/schema/index.ts
- [x] T008 Generate and review the initial reversible migration in src/db/migrations/0000_initial.sql
- [x] T009 Implement singleton MySQL pool and migration-safe client in src/db/index.ts
- [x] T010 [P] Implement exact CLP money helpers and validation in src/lib/money.ts
- [x] T011 [P] Implement typed application errors, safe messages, and correlation IDs in src/lib/errors.ts
- [x] T012 [P] Implement origin enforcement and shared Zod input helpers in src/lib/security.ts and src/lib/validation.ts
- [x] T013 Implement append-only redacted audit writer in src/features/audit/service.ts
- [x] T014 [P] Create accessible Button, Input, Field, Badge, Card, Table, EmptyState, and Alert components in src/components/ui/
- [x] T015 Create responsive application shell, skip link, sidebar, mobile drawer, and account menu in src/components/layout/app-shell.tsx
- [x] T016 Protect the dashboard route group with server-side session authorization in src/app/(dashboard)/layout.tsx
- [x] T017 Add unit tests for money, state-independent validation, and redaction in tests/unit/foundation.test.ts

**Checkpoint**: Database, server boundaries, design tokens, navigation shell, and shared tests are ready.

---

## Phase 3: User Story 1 - Acceso seguro al sistema (Priority: P1) ðŸŽ¯ Security MVP

**Goal**: Authorized users can sign in and out with revocable, throttled, role-aware sessions.

**Independent Test**: Valid credentials enter the dashboard; invalid, throttled, disabled, expired,
revoked, and unauthorized-role cases fail with safe messages and audit events.

- [x] T018 [P] [US1] Write password, session, throttle, and authorization unit tests in tests/unit/auth.test.ts
- [ ] T019 [P] [US1] Write login/logout integration tests against MySQL in tests/integration/auth.test.ts
- [ ] T020 [P] [US1] Write browser login, keyboard, and protected-route tests in tests/e2e/auth.spec.ts
- [x] T021 [US1] Implement Argon2id password hashing and verification in src/features/auth/password.ts
- [x] T022 [US1] Implement opaque session creation, hashing, expiry, rotation, and revocation in src/features/auth/session.ts
- [x] T023 [US1] Implement credential validation, database-backed throttling, and admin account lifecycle service in src/features/auth/service.ts
- [x] T024 [US1] Implement login/logout plus admin account and session-revocation actions with origin checks and audit events in src/features/auth/actions.ts
- [x] T025 [US1] Build the accessible login form and admin user/session management views in src/app/(auth)/login/login-form.tsx and src/app/(dashboard)/integraciones/usuarios/page.tsx
- [x] T026 [US1] Add a secure initial-admin seed command with no committed password in scripts/seed-admin.ts

**Checkpoint**: Authentication is independently deployable and testable.

---

## Phase 4: User Story 2 - Mantener clientes y catÃ¡logo (Priority: P1)

**Goal**: Authorized users manage validated, searchable, deactivatable clients and billable items.

**Independent Test**: Create, edit, search, and deactivate one client and one taxable service while
invalid RUT, email, price, and tax combinations are rejected.

- [ ] T027 [P] [US2] Write client and catalog validation/service tests in tests/unit/catalog-clients.test.ts
- [ ] T028 [P] [US2] Write client and catalog persistence tests in tests/integration/catalog-clients.test.ts
- [x] T029 [US2] Implement Chilean tax ID, client, and catalog schemas in src/features/clients/validation.ts and src/features/catalog/validation.ts
- [x] T030 [P] [US2] Implement client queries, commands, and audited actions in src/features/clients/service.ts and src/features/clients/actions.ts
- [x] T031 [P] [US2] Implement catalog queries, commands, and audited actions in src/features/catalog/service.ts and src/features/catalog/actions.ts
- [x] T032 [US2] Build searchable client list and create/edit form in src/app/(dashboard)/clientes/page.tsx and src/components/forms/client-form.tsx
- [x] T033 [US2] Build searchable product/service list and create/edit form in src/app/(dashboard)/productos-servicios/page.tsx and src/components/forms/catalog-item-form.tsx

**Checkpoint**: Master data is independently usable and ready for orders.

---

## Phase 5: User Story 3 - Crear y enviar una orden de pago (Priority: P1)

**Goal**: Create, calculate, issue, share, pay, expire, and cancel idempotent payment orders.

**Independent Test**: Create an order from known client/items, verify totals and state rules, open the
minimal public view, record a duplicate payment request, and observe only one financial effect.

- [x] T034 [P] [US3] Write order calculation and transition tests in tests/unit/orders.test.ts
- [ ] T035 [P] [US3] Write payment idempotency and concurrency tests in tests/integration/orders.test.ts
- [ ] T036 [P] [US3] Write public-order contract tests from contracts/openapi.yaml in tests/contract/public-orders.test.ts
- [x] T037 [US3] Implement order schemas, calculation, and transition policy in src/features/orders/domain.ts
- [x] T038 [US3] Implement transactional order creation, issue, payment, cancel, and optimistic concurrency services in src/features/orders/service.ts
- [x] T039 [US3] Implement authorized order server actions and minimal public token query in src/features/orders/actions.ts and src/features/orders/public.ts
- [x] T040 [US3] Build order list, filters, status badges, and order detail in src/app/(dashboard)/ordenes/page.tsx and src/app/(dashboard)/ordenes/[id]/page.tsx
- [x] T041 [US3] Build the keyboard-accessible order composer and confirmation steps in src/components/forms/order-form.tsx
- [x] T042 [US3] Build the revocation-safe public order page in src/app/orden/[publicToken]/page.tsx

**Checkpoint**: The core payment-order workflow works without invoice emission.

---

## Phase 6: User Story 4 - Emitir factura mediante IntellyDTE (Priority: P1)

**Goal**: Issue one invoice per paid order through a safe adapter with recoverable provider states.

**Independent Test**: The deterministic fake issues, rejects, delays, and times out; duplicate calls
return the same invoice and unknown outcomes reconcile before retry.

- [x] T043 [P] [US4] Write adapter contract and fake-provider tests in tests/contract/intellydte.test.ts
- [ ] T044 [P] [US4] Write transactional invoice idempotency tests in tests/integration/invoices.test.ts
- [x] T045 [US4] Implement IntellyDTE types, fake gateway, and fail-closed HTTP placeholder in src/features/integrations/intellydte.ts
- [ ] T046 [US4] Implement invoice state, attempt persistence, issue, and reconciliation service in src/features/billing/service.ts
- [x] T047 [US4] Implement authorized invoice action and API contract boundary in src/features/billing/actions.ts and src/app/api/orders/[orderId]/invoice/route.ts
- [x] T048 [US4] Build invoice queue, statuses, detail, issue confirmation, and retry guidance in src/app/(dashboard)/facturacion/page.tsx
- [ ] T049 [US4] Write paid-order-to-invoice browser workflow in tests/e2e/invoice.spec.ts

**Checkpoint**: Billing works end to end in fake mode; HTTP mode remains closed until provider docs exist.

---

## Phase 7: User Story 5 - Supervisar el negocio desde el dashboard (Priority: P2)

**Goal**: Present consistent period metrics, trends, state distribution, recent activity, and onboarding.

**Independent Test**: A seeded financial dataset produces exact expected metrics for each period; an
empty dataset shows guided actions and every chart has a textual alternative.

- [ ] T050 [P] [US5] Write dashboard aggregation tests with known data in tests/integration/dashboard.test.ts
- [x] T051 [US5] Implement indexed period aggregation and recent activity query in src/features/dashboard/service.ts
- [x] T052 [P] [US5] Build semantic metric cards and empty-state onboarding in src/components/dashboard/metric-card.tsx and src/components/dashboard/onboarding.tsx
- [x] T053 [P] [US5] Build accessible revenue trend and order-status visualizations with table fallback in src/components/dashboard/charts.tsx
- [x] T054 [US5] Assemble responsive filtered dashboard in src/app/(dashboard)/page.tsx

**Checkpoint**: Dashboard independently reconciles with source financial data.

---

## Phase 8: User Story 6 - Administrar integraciones y trazabilidad (Priority: P2)

**Goal**: Administrators inspect dependency health and safe audit history without secret disclosure.

**Independent Test**: Admin sees MySQL and fake-provider health plus redacted attempts; operator is
denied; simulated failures show actionable status and correlation IDs.

- [ ] T055 [P] [US6] Write role, health, and secret-redaction tests in tests/integration/integrations.test.ts
- [x] T056 [US6] Implement admin-only MySQL/IntellyDTE health and attempt queries in src/features/integrations/service.ts
- [x] T057 [US6] Implement health route without sensitive detail in src/app/api/health/route.ts
- [x] T058 [US6] Build integration status cards and redacted activity table in src/app/(dashboard)/integraciones/page.tsx

**Checkpoint**: Operational status is independently visible to administrators.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Close quality, deployment, accessibility, and live-provider readiness gaps.

- [x] T059 [P] Add loading, empty, error, and not-found boundaries in src/app/loading.tsx, src/app/error.tsx, and src/app/not-found.tsx
- [x] T060 [P] Add security headers and production runtime configuration in next.config.ts
- [x] T061 [P] Add print styles and safe order/invoice print views in src/app/globals.css and src/components/billing/print-document.tsx
- [ ] T062 Run automated accessibility, 375/768/1024/1440 viewport, and 25-user performance checks in tests/e2e/accessibility.spec.ts and tests/performance/dashboard.k6.js
- [ ] T063 Run lint, typecheck, unit, integration, browser, production build, and moderated 10-user task-completion gates from specs/001-business-management-mvp/quickstart.md
- [x] T064 Document Hostinger allowlisting/migration and pending IntellyDTE HTTP mapping evidence in README.md
- [ ] T065 Perform final secret scan, dependency audit, authorization review, and checklist update in specs/001-business-management-mvp/checklists/security.md

---

## Dependencies & Execution Order

- Setup blocks Foundation; Foundation blocks every user story.
- US1 blocks access to every internal story.
- US2 blocks normal order creation in US3.
- US3 blocks invoice emission in US4 and supplies financial data to US5.
- US4 can proceed in parallel with the US5 presentation layer once the order schema is stable.
- US6 depends on US1 authorization and the US4 adapter/attempt model.
- Polish follows the stories included in the delivery.

```text
Setup -> Foundation -> US1 -> US2 -> US3 -> US4
                              |       |      |
                              |       +----> US5
                              +------------> US6 (after adapter model)
All selected stories ----------------------> Polish
```

## Parallel Opportunities

- T002â€“T006 are independent setup files after T001.
- T010â€“T012 and T014 can proceed after schema conventions are agreed.
- Test tasks marked `[P]` can be written in parallel before implementation.
- US4 adapter work and US5 UI components can proceed in parallel after US3 domain contracts stabilize.
- Within US2, clients and catalog services are separate modules; within US5, cards and charts are separate.

## Parallel Example: User Story 3

```text
Task T034: order calculation/state tests
Task T035: MySQL idempotency/concurrency tests
Task T036: public contract tests
```

After those tests fail as expected, T037 precedes T038â€“T042.

## Implementation Strategy

1. **Security MVP**: Setup + Foundation + US1 proves protected access.
2. **Commercial MVP**: Add US2 + US3 for real payment-order operations.
3. **Billing MVP**: Add US4 with fake IntellyDTE and explicit live-integration gate.
4. **Operational MVP**: Add US5 + US6, then Polish and run every quality gate.
5. Enable Hostinger and IntellyDTE live connections only after external credentials, allowlisting,
   migration backup, provider contract fixtures, and sandbox evidence are available.

## Format Validation

- Total tasks: 65
- User story tasks: US1 9, US2 7, US3 9, US4 7, US5 5, US6 4
- Every task uses a checkbox, sequential ID, appropriate story label, and concrete file path.

