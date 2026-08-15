# Fiscal Billing and Signed XML PDF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emit DTE 33 invoices through the local IntellyDTE contract, process webhooks idempotently, persist signed XML evidence, and reconstruct every fiscal PDF inside the gestor with the original TED/PDF417.

**Architecture:** Replace the closed HTTP gateway with a typed provider adapter. Store provider metadata and private evidence separately from short-lived traces. Parse signed XML with namespace-safe selectors and render a fiscal PDF in Node using the gestor's own renderer.

**Tech Stack:** TypeScript, Next.js Route Handlers/Server Actions, Drizzle/MySQL, Zod, `jsPDF`, `jspdf-autotable`, `bwip-js`, an XML parser, Node crypto, Vitest, and Playwright.

**Spec:** `docs/superpowers/specs/2026-08-14-commercial-workflows-and-fiscal-integration-design.md`

## Global Constraints

- Run after the shared UI, catalog/client, and order POS plans.
- Use the local contract in `C:\laragon\www\intellydte` and payload mapping in `C:\laragon\www\bevox`.
- IntellyDTE does not render or deliver PDFs for this flow.
- The signed XML is the only fiscal source of truth.
- Never issue a second create request after an uncertain provider response without status reconciliation.
- Signed XML/PDF evidence is private and downloaded only through authenticated routes.
- No commit or push during execution.

---

### Task 1: Fiscal dependencies and evidence schema

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/db/schema/index.ts`
- Create: `src/db/migrations/0005_fiscal_evidence.sql` via Drizzle generation
- Create: `src/features/billing/evidence.ts`
- Test: `tests/unit/fiscal-evidence.test.ts`

**Interfaces:**
- Produces `storeSignedXml(invoiceId, metadata, xml): Promise<SignedFiscalEvidence>`.
- Produces `storeReconstructedPdf(invoiceId, metadata, pdf): Promise<SignedFiscalEvidence>`.
- Produces `getFiscalEvidence(invoiceId): Promise<FiscalEvidence | null>`.

- [ ] **Step 1: Write failing schema and storage tests**

Assert invoice provider fields, an evidence artifact relation, SHA-256 hashes, renderer version, and private storage keys. Assert that a stored XML can be read by the server and is not returned as a public URL.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- tests/unit/fiscal-evidence.test.ts`

Expected: FAIL because evidence schema and storage helpers do not exist.

- [ ] **Step 3: Add dependencies and schema**

Add `bwip-js` and a namespace-safe XML parser compatible with Node 22. Add invoice fields for `trackId`, `siiStatus`, `siiGlosa`, and evidence linkage. Add an `invoice_evidence` table with invoice ID, kind, storage key, SHA-256, MIME type, DTE type, folio, renderer version, and timestamps.

- [ ] **Step 4: Implement private evidence storage**

Use a configured server-only storage directory, sanitize path fragments, calculate SHA-256 before writing, write atomically, and persist the metadata transactionally. Refuse empty XML/PDF and validate PDF magic bytes.

- [ ] **Step 5: Generate migration and run tests**

Run `npm run db:generate`, inspect SQL, then run `npm test -- tests/unit/fiscal-evidence.test.ts` and `npm run typecheck`.

Expected: PASS.

### Task 2: Typed IntellyDTE HTTP gateway

**Files:**
- Modify: `src/features/integrations/intellydte.ts`
- Modify: `src/features/integrations/config-service.ts`
- Modify: `src/lib/env.ts`
- Create: `src/features/integrations/intellydte-contract.ts`
- Test: `tests/unit/intellydte-gateway.test.ts`

**Interfaces:**
- Produces `IntellyDteGateway.issueInvoice(command): Promise<InvoiceResult>`.
- Produces `IntellyDteGateway.getInvoiceStatus(dteRecordId): Promise<InvoiceStatusResult>`.
- Produces `IntellyDteGateway.lookupRut(rut)` for the catalog/client plan.

- [ ] **Step 1: Write failing contract tests**

Mock `fetch` and assert an invoice request uses:

```ts
expect(fetch).toHaveBeenCalledWith(
  "https://dte.example/api/v1/dte/factura",
  expect.objectContaining({
    method: "POST",
    headers: expect.objectContaining({
      "x-api-key": "key",
      "Idempotency-Key": "invoice:order-1",
      "x-intelly-emission-mode": "sync",
    }),
  }),
);
```

Assert that `data.printPayload.signedXmlBase64`, `dteRecordId`, folio, track ID, and SII status are normalized. Assert 400, 401, 409, 5xx, timeout, and malformed JSON outcomes.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- tests/unit/intellydte-gateway.test.ts`

Expected: FAIL because the current gateway sends bearer auth to the base URL and has no issue/status implementation.

- [ ] **Step 3: Implement the contract adapter**

Normalize base URL and append `/api/v1` exactly once. Use `x-api-key`, idempotency and emission headers, bounded timeout, no unsafe retry for emission, and safe response parsing. Preserve raw sanitized request/response data for the observability plan.

- [ ] **Step 4: Implement status reconciliation**

Use the local status endpoint exposed by IntellyDTE/Bevox contract and normalize provider identifiers without inventing an endpoint. If the configured provider status route is unavailable, return a typed `pending`/`unavailable` result rather than retrying creation.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `npm test -- tests/unit/intellydte-gateway.test.ts` and `npm run typecheck`.

Expected: PASS.

### Task 3: XML parser and fiscal PDF renderer

**Files:**
- Create: `src/features/billing/xml.ts`
- Create: `src/features/billing/fiscal-pdf.ts`
- Modify: `src/features/billing/service.ts`
- Create: `tests/fixtures/fiscal/factura-33-signed.xml`
- Test: `tests/unit/fiscal-xml-pdf.test.ts`

**Interfaces:**
- Produces `parseSignedDteXml(xml): ParsedDteDocument`.
- Produces `renderFiscalPdf(document): Promise<Uint8Array>`.
- Produces `renderTedPdf417(tedXml): Promise<string>` as a PNG data URL/base64 helper.

- [ ] **Step 1: Add fixture-based failing tests**

Use a sanitized DTE 33 XML fixture containing namespace, issuer, receiver, detail, totals, references, and TED. Assert parser output for type, folio, RUTs, names, line count, net, IVA, total, and exact TED XML.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- tests/unit/fiscal-xml-pdf.test.ts`

Expected: FAIL because parser and renderer do not exist.

- [ ] **Step 3: Implement namespace-safe XML parsing**

Use local-name or parser namespace APIs so prefixed and unprefixed SII XML work. Reject missing Documento, IdDoc, Emisor, Receptor, Totales, or TED. Parse numeric fields as integer CLP values and preserve original date strings.

- [ ] **Step 4: Implement TED/PDF417**

Extract the original TED node from the XML, preserve its exact serialized content where possible, encode using the Latin-1-safe behavior from `C:\laragon\www\intellydte\src\utils\pdf417.util.ts`, and generate a PDF417 PNG. Return a typed error when the TED cannot be encoded.

- [ ] **Step 5: Implement the fiscal layout**

Create a separate `jsPDF` renderer with fiscal header box, DTE type/folio, issuer/receptor sections, detail table, totals, references, resolution fields when present, and the generated PDF417 image plus TED verification text. Do not reuse commercial order labels, banking instructions, or order totals.

- [ ] **Step 6: Validate renderer output**

Assert PDF magic bytes, expected folio/type text where extractable, and deterministic totals. Run the fixture test and `npm run typecheck`.

Expected: PASS.

### Task 4: Invoice emission action and webhook route

**Files:**
- Modify: `src/features/billing/actions.ts`
- Modify: `src/features/billing/service.ts`
- Create: `src/features/billing/emission.ts`
- Create: `src/app/api/webhooks/intellydte/route.ts`
- Modify: `src/db/schema/index.ts`
- Test: `tests/unit/billing-emission.test.ts`
- Test: `tests/unit/intellydte-webhook.test.ts`

**Interfaces:**
- Produces `issueInvoice(orderId, userId): Promise<InvoiceResult>`.
- Produces `handleIntellyDteWebhook(rawBody, signature): Promise<WebhookResult>`.

- [ ] **Step 1: Write failing emission and webhook tests**

Cover local invoice creation before provider call, stable idempotency key, XML/PDF evidence creation on issued response, pending on uncertain response, rejection persistence, HMAC verification, event deduplication, and accepted/rejected state updates.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- tests/unit/billing-emission.test.ts tests/unit/intellydte-webhook.test.ts`

Expected: FAIL because emission still uses the placeholder gateway and no webhook route exists.

- [ ] **Step 3: Implement emission orchestration**

Load paid order/client with all lines, build the exact payload, create `invoices` and an integration attempt before the network call, call the gateway once, decode and store signed XML, parse it, render/store fiscal PDF, and update invoice/order atomically. Use the stable key `invoice:${orderId}`.

- [ ] **Step 4: Implement webhook security and reconciliation**

Read the raw request body, calculate HMAC-SHA256 with the configured encrypted secret, compare with constant time, reject invalid signatures, deduplicate by provider event ID, and update invoice/order/evidence fields in one transaction. Acknowledge unknown events safely and record them.

- [ ] **Step 5: Run focused tests and typecheck**

Run the focused tests and `npm run typecheck`.

Expected: PASS.

### Task 5: Billing list and fiscal PDF download

**Files:**
- Modify: `src/features/billing/service.ts`
- Modify: `src/app/(dashboard)/facturacion/page.tsx`
- Modify: `src/app/(dashboard)/facturacion/billing-manager.tsx`
- Create: `src/app/api/invoices/[id]/pdf/route.ts`
- Create: `src/app/api/invoices/[id]/xml/route.ts`
- Test: `tests/unit/billing-ui.test.ts`
- Test: `tests/e2e/billing.spec.ts`

**Interfaces:**
- Billing list consumes shared `PageQuery` plus status/date filters.
- Download routes require `requireUser()` and return private PDF/XML evidence with `Cache-Control: private, no-store`.

- [ ] **Step 1: Write failing UI and route tests**

Assert issued invoice rows expose an icon-only PDF action, route authorization, 404 for missing evidence, and correct `application/pdf` headers. Assert the list has search/filter/pagination and no redundant table card.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- tests/unit/billing-ui.test.ts`

Expected: FAIL because fiscal evidence routes and actions do not exist.

- [ ] **Step 3: Implement secure evidence routes**

Load evidence by invoice ID, authorize the session, stream private bytes, set `Content-Disposition` with a sanitized folio, `nosniff`, and no-store headers.

- [ ] **Step 4: Refactor billing UI**

Convert issue/download/status actions to icons with tooltips, add status filters and pagination, and show Spanish provider status/glosa. Keep historical import behavior separate.

- [ ] **Step 5: Run fiscal phase gate**

Run:

```powershell
npm run lint
npm run typecheck
npm test
npx playwright test tests/e2e/billing.spec.ts
```

Expected: PASS with fake provider fixtures. Live HTTP mode remains disabled.
