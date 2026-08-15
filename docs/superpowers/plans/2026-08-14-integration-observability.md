# Integration Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist and display detailed, Spanish, sanitized integration traces with request/response JSON, webhook correlation, filters, pagination, and retention.

**Architecture:** Instrument the IntellyDTE gateway and webhook handler through one trace service. Store sanitized JSON in a dedicated trace shape, preserve fiscal evidence separately, and expose a server-rendered list with a focused client detail viewer.

**Tech Stack:** TypeScript, Next.js Server Components/Route Handlers, Drizzle/MySQL JSON columns, Zod, React, Vitest, and Playwright.

**Spec:** `docs/superpowers/specs/2026-08-14-commercial-workflows-and-fiscal-integration-design.md`

## Global Constraints

- Run after fiscal billing instrumentation points exist.
- Redact nested secret keys before persistence, not only before rendering.
- Keep signed XML and PDFs in evidence storage, not transient trace JSON.
- Preserve original provider code/status beside Spanish presentation labels.
- Integration details are authenticated and authorized.
- No commit or push during execution.

---

### Task 1: Trace schema and redaction service

**Files:**
- Modify: `src/db/schema/index.ts`
- Create: `src/db/migrations/0006_integration_traces.sql` via Drizzle generation
- Create: `src/features/audit/integration-traces.ts`
- Create: `src/lib/redaction.ts`
- Test: `tests/unit/integration-traces.test.ts`

**Interfaces:**
- Produces `sanitizeIntegrationValue(value): unknown`.
- Produces `recordIntegrationTrace(input): Promise<string>`.
- Produces `getIntegrationTrace(id): Promise<IntegrationTrace | null>`.

- [ ] **Step 1: Write failing redaction tests**

```ts
expect(sanitizeIntegrationValue({
  headers: { "x-api-key": "secret", Authorization: "Bearer secret" },
  nested: { webhookSecret: "secret" },
  folio: 100,
})).toEqual({
  headers: { "x-api-key": "[REDACTED]", Authorization: "[REDACTED]" },
  nested: { webhookSecret: "[REDACTED]" },
  folio: 100,
});
```

Assert arrays, nulls, strings, and deeply nested keys are handled without mutating the input.

- [ ] **Step 2: Run focused test and confirm RED**

Run: `npm test -- tests/unit/integration-traces.test.ts`

Expected: FAIL because the redaction and trace service do not exist.

- [ ] **Step 3: Add trace schema and migration**

Add trace ID, integration, operation, event type, direction, endpoint, status, provider code, safe message, request JSON, response JSON, headers JSON, duration, source invoice/order ID, webhook event ID, and timestamps. Add indexes for occurred time, correlation, operation, result, and aggregate.

- [ ] **Step 4: Implement recursive sanitization and persistence**

Redact keys matching API key, authorization, cookie, password, secret, token, private key, certificate, and credential patterns. Truncate only unbounded diagnostic strings; preserve complete JSON structure otherwise. Persist the sanitized copy and return the trace ID.

- [ ] **Step 5: Generate migration and run tests**

Run `npm run db:generate`, `npm test -- tests/unit/integration-traces.test.ts`, and `npm run typecheck`.

Expected: PASS.

### Task 2: Gateway and webhook instrumentation

**Files:**
- Modify: `src/features/integrations/intellydte.ts`
- Modify: `src/features/billing/emission.ts`
- Modify: `src/app/api/webhooks/intellydte/route.ts`
- Modify: `src/features/audit/integration-traces.ts`
- Test: `tests/unit/integration-traces.test.ts`

**Interfaces:**
- Every outbound attempt records request, response/error, duration, correlation ID, and related aggregate.
- Every inbound webhook records raw-event metadata after sanitization and links to the invoice trace.

- [ ] **Step 1: Add failing correlation tests**

Assert an emission trace and its webhook traces share correlation or provider identifiers, that a rejected response stores provider code/message, and that a timeout records an uncertain result without a duplicate call.

- [ ] **Step 2: Run focused test and confirm RED**

Run: `npm test -- tests/unit/integration-traces.test.ts`

Expected: FAIL because gateway calls are not instrumented.

- [ ] **Step 3: Instrument outbound calls**

Create a correlation ID before the request, capture method/endpoint/allowed headers/request payload, measure duration, normalize status, and call `recordIntegrationTrace` in success and failure paths. Never log the API key.

- [ ] **Step 4: Instrument inbound webhooks**

Record signature verification result, event ID, event type, provider identifiers, processing status, and response JSON after the handler completes. Preserve raw body only if sanitization policy permits; otherwise store parsed sanitized JSON.

- [ ] **Step 5: Run tests and typecheck**

Run the focused trace tests and `npm run typecheck`.

Expected: PASS.

### Task 3: Spanish presentation dictionary and trace queries

**Files:**
- Create: `src/features/integrations/presentation.ts`
- Create: `src/features/integrations/trace-service.ts`
- Modify: `src/features/integrations/actions.ts`
- Test: `tests/unit/integration-presentation.test.ts`

**Interfaces:**
- Produces `getIntegrationLabel(value): string` and `getIntegrationStatusLabel(value): string`.
- Produces `listIntegrationTraces(query): Promise<PageResult<IntegrationTraceListItem>>`.
- Produces `getIntegrationTraceDetail(id): Promise<IntegrationTraceDetail | null>`.

- [ ] **Step 1: Write failing dictionary and query tests**

Assert mappings for `issue_invoice`, `processing`, `accepted`, `review_required`, `rejected`, `unavailable`, `request`, `response`, `error`, `outbound`, `inbound`, and unknown values. Assert filters for status, direction, event, operation, date, correlation ID, folio, and DTE record ID.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- tests/unit/integration-presentation.test.ts`

Expected: FAIL because the dictionary and trace queries do not exist.

- [ ] **Step 3: Implement labels and server queries**

Return original values plus Spanish labels. Use validated shared page query parsing, bounded search, deterministic newest-first ordering, and parameterized Drizzle conditions.

- [ ] **Step 4: Add authorization and retention filtering**

Require an authenticated user, limit detail access to permitted roles, and exclude operational traces beyond the configured retention window while leaving fiscal evidence available through its own route.

- [ ] **Step 5: Run tests and typecheck**

Run the focused tests and `npm run typecheck`.

Expected: PASS.

### Task 4: Integration list and JSON detail UI

**Files:**
- Modify: `src/app/(dashboard)/integraciones/page.tsx`
- Modify: `src/app/(dashboard)/integraciones/integration-manager.tsx`
- Create: `src/app/(dashboard)/integraciones/trace-detail.tsx`
- Modify: `src/components/ui/index.ts`
- Test: `tests/unit/integration-ui.test.ts`
- Test: `tests/e2e/integrations.spec.ts`

**Interfaces:**
- The page passes paginated trace data and filter options to the manager.
- `TraceDetail` receives a sanitized `IntegrationTraceDetail` and renders no raw secret fields.

- [ ] **Step 1: Write failing UI tests**

Assert searchable/filterable/paginated activity, Spanish status labels, icon-only row action, and detail rendering of request/response JSON with an expand/copy control.

- [ ] **Step 2: Run focused test and confirm RED**

Run: `npm test -- tests/unit/integration-ui.test.ts`

Expected: FAIL because the activity table has no detail interaction or filters.

- [ ] **Step 3: Implement the list and detail boundary**

Use a server-rendered list with URL filters and a client detail drawer/page. Render JSON with stable two-space formatting, a copy action, collapsed large arrays, and explicit “redactado” indicators. Keep icon-only controls accessible through labels/tooltips.

- [ ] **Step 4: Add Spanish operational copy**

Show method, endpoint, timing, HTTP status, original provider code, Spanish explanation, webhook timeline, and evidence links where authorized.

- [ ] **Step 5: Run focused tests and E2E**

Run `npm test -- tests/unit/integration-ui.test.ts` and `npx playwright test tests/e2e/integrations.spec.ts`.

Expected: PASS.

### Task 5: Retention and final observability gate

**Files:**
- Create: `scripts/purge-integration-traces.ts`
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `src/features/integrations/trace-service.ts`
- Test: `tests/unit/integration-retention.test.ts`

**Interfaces:**
- `npm run db:purge-integration-traces` deletes only operational traces older than configured retention and never deletes fiscal evidence.

- [ ] **Step 1: Write failing retention tests**

Create old/new operational traces and fiscal evidence, run the purge service, and assert only old operational traces are removed.

- [ ] **Step 2: Run focused test and confirm RED**

Run: `npm test -- tests/unit/integration-retention.test.ts`

Expected: FAIL because retention command does not exist.

- [ ] **Step 3: Implement bounded purge**

Read a positive retention-days environment value with a safe default, delete in batches by timestamp, report counts without payloads, and leave evidence artifacts untouched.

- [ ] **Step 4: Add final integration verification**

Run:

```powershell
npm run lint
npm run typecheck
npm test
npx playwright test tests/e2e/integrations.spec.ts
```

Expected: PASS, with sanitized JSON detail and correlated emission/webhook traces.
