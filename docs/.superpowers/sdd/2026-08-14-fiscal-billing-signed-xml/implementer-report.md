# Implementer Report

Plan: `docs/superpowers/plans/2026-08-14-fiscal-billing-signed-xml.md`

## Implemented

- Task 1: Added `bwip-js` and `fast-xml-parser`, invoice provider/evidence fields, private atomic fiscal evidence storage, SHA-256 metadata, encrypted webhook-secret fields, and migration `src/db/migrations/0008_peaceful_serpent_society.sql`.
- Task 2: Replaced the closed HTTP gateway with a typed IntellyDTE adapter for `/api/v1/dte/factura`, status reconciliation, RUT lookup, API-key/idempotency/emission-mode headers, bounded timeout, safe response normalization, and pending handling for uncertain responses.
- Task 3: Added namespace-safe signed XML parsing, exact TED extraction, Latin-1-safe PDF417 generation, and a separate local fiscal PDF renderer. The renderer consumes signed XML only and does not call or accept a provider PDF.
- Task 4: Added DTE 33 payload mapping, pre-call invoice/attempt persistence, single-call emission orchestration, signed XML and reconstructed PDF materialization, webhook HMAC verification, event deduplication, unknown-event acknowledgement, and invoice/order reconciliation.
- Task 5: Added authenticated private PDF/XML evidence routes, billing download actions, provider SII/glosa display, billing E2E coverage, and encrypted webhook-secret configuration input.

## Files

- `package.json`, `package-lock.json`, `.env.example`
- `src/db/schema/index.ts`
- `src/db/migrations/0008_peaceful_serpent_society.sql`
- `src/db/migrations/0009_broken_warbird.sql`
- `src/db/migrations/meta/0008_snapshot.json`, `src/db/migrations/meta/_journal.json`
- `src/lib/env.ts`
- `src/features/billing/actions.ts`
- `src/features/billing/service.ts`
- `src/features/billing/emission.ts`
- `src/features/billing/evidence.ts`
- `src/features/billing/xml.ts`
- `src/features/billing/fiscal-pdf.ts`
- `src/features/integrations/actions.ts`
- `src/features/integrations/config-service.ts`
- `src/features/integrations/intellydte.ts`
- `src/features/integrations/intellydte-contract.ts`
- `src/app/api/webhooks/intellydte/route.ts`
- `src/app/api/invoices/[id]/pdf/route.ts`
- `src/app/api/invoices/[id]/xml/route.ts`
- `src/app/api/invoices/[id]/status/route.ts`
- `src/app/(dashboard)/facturacion/page.tsx`
- `src/app/(dashboard)/facturacion/billing-manager.tsx`
- `src/app/(dashboard)/integraciones/integration-manager.tsx`
- `tests/fixtures/fiscal/factura-33-signed.xml`
- `tests/unit/fiscal-evidence.test.ts`
- `tests/unit/intellydte-gateway.test.ts`
- `tests/unit/fiscal-xml-pdf.test.ts`
- `tests/unit/billing-emission.test.ts`
- `tests/unit/intellydte-webhook.test.ts`
- `tests/unit/fiscal-orchestration.test.ts`
- `tests/unit/fiscal-webhook-persistence.test.ts`
- `tests/unit/fiscal-webhook-route.test.ts`
- `tests/unit/fiscal-route-contract.test.ts`
- `tests/unit/billing-ui.test.ts`
- `tests/e2e/billing.spec.ts`

## Verification

- `npm.cmd run db:generate`: passed; SQL inspected. Migration is `0008`, not the plan's `0005`, because prior shared-workflow migrations already occupy `0000` through `0007` and were preserved.
- Focused fiscal tests: 6 files, 15 tests passed.
- `npm.cmd test`: 40 files, 171 tests passed.
- `npm.cmd run lint`: passed with 0 warnings and 0 errors.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run test:legacy-render`: 14 tests passed.
- `npm.cmd run build`: passed; Next.js emitted all billing, webhook, and evidence routes.
- `npx.cmd playwright test tests/e2e/billing.spec.ts`: 2 tests skipped because `E2E_USER_EMAIL` and `E2E_USER_PASSWORD` were not configured.

## Concerns

- No `DATABASE_URL` was configured, so build bootstrap did not apply migrations and no database-backed emission/webhook integration test ran.
- Live HTTP mode remains disabled by the default fake mode and was not exercised against a provider sandbox.
- The local IntellyDTE sandbox must still be used to verify issuer configuration, folios, webhook delivery, exact signed XML, and SII status semantics before activation.
- Existing unrelated worktree changes, plans, docs, `output/`, and `tmp/` artifacts were preserved. No commit or push was performed.

## Review Remediation

- Corrected DTE 33 mapping to keep original unit price and send `descuentoMonto`/`descuentoPct`; added consistency preflight for line and order totals.
- Added tenant `ik_*` and system `isk_*` encrypted credential fields, tenant RUT propagation, split UI/env contracts, root `/health`, and `async` as the real-mode default while fake mode remains the safe default.
- Added provider-body/identifier preservation, reconciliation-before-retry, incrementing attempt numbers, idempotency-in-progress handling, and SII rejection classification.
- Made webhook correlation tenant-scoped by `dteRecordId`, payloads recursively redacted, terminal states monotonic, and issued state dependent on signed evidence. Provider-issued local PDF failures remain issued and retryable.
- Preserved base64 XML bytes exactly, decoded declared ISO-8859-1 XML correctly, verified evidence hashes, added restrictive storage permissions, and versioned evidence regeneration.
- Added fiscal PDF due dates, explicit discounts, and page-safe TED placement.
- Added authenticated status refresh action/route, billing date filters, emission/webhook audit events, provider-contract regressions, orchestration tests, webhook persistence/route tests, exact-byte/XML-match tests, evidence hash tests, and status-refresh route tests.

## Review Verification

- `npm.cmd test -- tests/unit/fiscal-evidence.test.ts tests/unit/intellydte-gateway.test.ts tests/unit/fiscal-xml-pdf.test.ts tests/unit/billing-emission.test.ts tests/unit/fiscal-orchestration.test.ts tests/unit/fiscal-webhook-persistence.test.ts tests/unit/fiscal-webhook-route.test.ts tests/unit/fiscal-route-contract.test.ts`: 8 files, 25 tests passed.
- `npm.cmd run db:generate`: passed; generated and inspected `src/db/migrations/0009_broken_warbird.sql`.
- `npm.cmd test`: 44 files, 184 tests passed.

## Final Verification

- `npm.cmd run lint`: passed with 0 warnings and 0 errors.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run test:legacy-render`: 14 tests passed.
- `npm.cmd run build`: passed; generated `/api/invoices/[id]/status`, `/api/webhooks/intellydte`, and private evidence routes. Build bootstrap skipped database migration because `DATABASE_URL` was not configured.
- `npx.cmd playwright test tests/e2e/billing.spec.ts`: 2 tests skipped, one desktop and one mobile, because `E2E_USER_EMAIL` and `E2E_USER_PASSWORD` were not configured.
- `git diff --check`: no whitespace errors.

## Post-Reconciliation Verification

- `npm.cmd test`: 44 files, 184 tests passed after the final tenant-RUT normalization and local PDF retry changes.
