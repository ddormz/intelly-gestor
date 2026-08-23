# Billing Documents and Order Invoicing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct fiscal document encoding, improve the local invoice PDF, make invoice email delivery diagnosable, and allow issuing invoices directly from issued orders without requiring payment.

**Architecture:** Keep IntellyDTE as the fiscal source and preserve the original signed XML bytes. Add a byte-aware decoding boundary for parsing and downloads, keep PDF reconstruction synchronous/local, and reuse the existing billing Server Action from the Orders client UI. SII acceptance remains the only event that changes an order to `invoiced`.

**Tech Stack:** Next.js App Router, React Server Actions, TypeScript, Drizzle MySQL, Vitest, jsPDF, jspdf-autotable, bwip-js, Nodemailer, Poppler for visual PDF QA.

## Global Constraints

- Preserve original signed XML bytes; do not rewrite fiscal content or introduce redaction.
- Treat the attached Bevox PDF as visual reference only; do not copy its HTML/CSS or branding.
- Use `parseSignedDteXmlBytes` for fiscal parsing and `renderFiscalPdf` for synchronous local reconstruction.
- Do not mark an invoice or order as accepted/invoiced unless `isSiiAcceptedStatus` confirms the provider status.
- Every production behavior change requires a failing test before implementation.
- Keep Server Actions authenticated, same-origin protected, input-validated, and revalidate `/ordenes`, `/facturacion`, and `/` when their mutations affect those routes.

---

### Task 1: Make XML decoding and download charset byte-aware

**Files:**
- Modify: `src/features/billing/xml.ts:159-167`
- Modify: `src/features/billing/evidence.ts:91-96`
- Modify: `src/features/billing/service.ts:150-158`
- Modify: `src/app/api/invoices/[id]/xml/route.ts:14-16`
- Test: `tests/unit/billing-emission.test.ts`
- Test: `tests/unit/fiscal-xml-pdf.test.ts`

**Interfaces:**
- `decodeSignedDteXml(bytes: Uint8Array): string` remains the parser entry point and chooses a valid UTF-8 representation before Latin-1 fallback.
- `detectXmlEncoding(bytes: Uint8Array): string` returns `UTF-8` for valid UTF-8 bytes and the declared/fallback Latin-1 value for actual legacy bytes.
- `sendInvoiceMessage` receives the XML attachment as original `Uint8Array` bytes rather than a Latin-1 round-trip string.

- [ ] **Step 1: Add the failing UTF-8-with-ISO regression test.**

  In `tests/unit/billing-emission.test.ts`, construct XML with `encoding="ISO-8859-1"`, encode it with `Buffer.from(source, "utf8")`, and assert `parseSignedDteXmlBytes(bytes).receiver.name` equals `"NIÑO SPA"`. Add a second assertion using `"PRESTACIÓN DE SERVICIOS INFORMÁTICOS Y MATERIAS AFINES"` in `GiroEmis` and assert the parsed business line remains exact.

- [ ] **Step 2: Run the focused test and confirm the expected failure.**

  Run `npx vitest run tests/unit/billing-emission.test.ts`. It must fail because the current implementation obeys the ISO declaration and decodes the UTF-8 bytes as Latin-1, producing `NIÃ‘O SPA`/`PRESTACIÃ“N...`.

- [ ] **Step 3: Implement strict UTF-8 detection with legacy fallback.**

  In `src/features/billing/xml.ts`, try `new TextDecoder("utf-8", { fatal: true }).decode(bytes)` first. If it succeeds, use it even when the declaration says ISO-8859-1; if it fails, use the existing Latin-1/Windows-1252 fallback for declarations that request it, otherwise throw `DTE_XML_ENCODING_INVALID`.

- [ ] **Step 4: Add the failing metadata/download regression test.**

  Extend the evidence/route coverage so valid UTF-8 XML bytes whose declaration says ISO-8859-1 are reported as `UTF-8`, while actual Latin-1 bytes remain `ISO-8859-1`. The assertion must inspect the response `Content-Type` charset and must not assert that the stored bytes changed.

- [ ] **Step 5: Implement effective encoding metadata and raw-byte email attachments.**

  Update `detectXmlEncoding` to use the same strict UTF-8 check before reading the declaration. Update the invoice service to pass `xmlArtifact.bytes` directly to the mailer. Keep the XML route returning the stored bytes and use the artifact encoding for its charset header.

- [ ] **Step 6: Run the focused encoding and route tests.**

  Run `npx vitest run tests/unit/billing-emission.test.ts tests/unit/fiscal-xml-pdf.test.ts tests/unit/fiscal-xml-route.test.ts`. Expected result: all tests pass with no mojibake regression.

- [ ] **Step 7: Commit the encoding boundary.**

  Run `git diff --check`, then commit with `git add src/features/billing/xml.ts src/features/billing/evidence.ts src/features/billing/service.ts src/app/api/invoices/[id]/xml/route.ts tests/unit/billing-emission.test.ts tests/unit/fiscal-xml-pdf.test.ts tests/unit/fiscal-xml-route.test.ts && git commit -m "fix: preserve fiscal document encoding"`.

### Task 2: Rebuild the local fiscal PDF layout

**Files:**
- Modify: `src/features/billing/fiscal-pdf.ts:1-238`
- Modify: `src/features/billing/evidence-orchestration.ts:128-130`
- Modify: `src/features/billing/emission.ts:104-109`
- Test: `tests/unit/fiscal-xml-pdf.test.ts`
- Create: `tmp/pdfs/` only for visual QA output; remove generated PNGs after review

**Interfaces:**
- `renderFiscalPdf(document: ParsedDteDocument): Promise<Uint8Array>` remains the only renderer API used by evidence orchestration and regeneration.
- Renderer metadata remains `rendererVersion: "fiscal-pdf-v2"` unless the implementation increments it to a clearly new renderer version.

- [ ] **Step 1: Add a failing layout contract test.**

  Extend `tests/unit/fiscal-xml-pdf.test.ts` with a fixture containing accented issuer data, due date, a long detail description, and a reference. Assert the generated PDF is valid and that a pure exported layout contract (for example `buildFiscalPdfSections(document)`) contains sections named `INFORMACIÓN DEL RECEPTOR`, `DETALLE DEL DOCUMENTO`, `INFORMACIÓN DE PAGOS`, and `RESUMEN DEL DOCUMENTO`. The current renderer has no such contract and the test must fail before implementation.

- [ ] **Step 2: Run the PDF contract test to verify RED.**

  Run `npx vitest run tests/unit/fiscal-xml-pdf.test.ts`. Confirm the failure is the missing layout contract, not a fixture or import error.

- [ ] **Step 3: Implement a compact traditional DTE layout.**

  Refactor `src/features/billing/fiscal-pdf.ts` around small helpers for wrapped text, labels, issuer/receptor blocks, section bands, detail table, payment block, totals, TED, resolution and receipt footer. Use `document` fields only, do not hardcode an SII regional unit, and keep `autoTable` page breaks for long details. Keep a compact invoice on one page and allow a second page only when content requires it.

- [ ] **Step 4: Keep generated evidence synchronous and versioned.**

  Ensure both `materializeInvoiceEvidence` and `retryLocalPdf` call the new renderer directly and store the resulting PDF before returning success. If the visual layout changes materially, use `rendererVersion: "fiscal-pdf-v3"` in both call sites and update the evidence tests accordingly.

- [ ] **Step 5: Run the focused PDF tests.**

  Run `npx vitest run tests/unit/fiscal-xml-pdf.test.ts tests/unit/evidence-orchestration.test.ts tests/unit/fiscal-regeneration.test.ts`. Expected result: all pass.

- [ ] **Step 6: Render and visually inspect short and long documents.**

  Generate test PDFs from the fixture with a small script or Vitest helper, render them with `pdftoppm -png -r 150`, and inspect every page with `view_image`. Verify no clipped issuer text, no mojibake, aligned columns, readable TED, visible totals, and no unnecessary blank page. Delete the PNG intermediates afterward.

- [ ] **Step 7: Commit the PDF layout.**

  Run `git diff --check`, then commit with `git add src/features/billing/fiscal-pdf.ts src/features/billing/evidence-orchestration.ts src/features/billing/emission.ts tests/unit/fiscal-xml-pdf.test.ts tests/unit/evidence-orchestration.test.ts tests/unit/fiscal-regeneration.test.ts && git commit -m "feat: improve fiscal invoice PDF layout"`.

### Task 3: Correct invoice status icon and artifact actions

**Files:**
- Modify: `src/app/(dashboard)/facturacion/billing-manager.tsx:71-85,489-539`
- Test: `tests/unit/billing-ui.test.ts`

**Interfaces:**
- `FiscalStatusIcon` continues accepting `{ status, siiStatus, siiGlosa }` but emits a label-only tooltip/ARIA label with no glosa/EPR suffix.
- Regeneration action is rendered only when `item.status === "issued" && !item.hasPdf`.

- [ ] **Step 1: Update UI tests to describe the desired behavior.**

  In `tests/unit/billing-ui.test.ts`, assert that an issued invoice without PDF contains `Regenerar PDF tributario`, while `renderInvoice("issued", true, true)` does not contain it. Add a case with `siiGlosa: "EPR-..."` and assert the generated HTML contains `aria-label="Aceptado por SII"` but not the EPR text.

- [ ] **Step 2: Run the focused UI test and confirm RED.**

  Run `npx vitest run tests/unit/billing-ui.test.ts`. It must fail because the current regeneration condition ignores `hasPdf` and the tooltip includes `siiGlosa`.

- [ ] **Step 3: Implement the minimal rendering conditions.**

  Remove glosa from the icon title/ARIA label and gate the regeneration modal by `!item.hasPdf`. Preserve the existing disabled/download behavior and the refresh action for missing artifacts.

- [ ] **Step 4: Run the focused UI test.**

  Run `npx vitest run tests/unit/billing-ui.test.ts`; expected result is green.

- [ ] **Step 5: Commit the UI behavior.**

  Run `git diff --check`, then commit with `git add src/app/(dashboard)/facturacion/billing-manager.tsx tests/unit/billing-ui.test.ts && git commit -m "fix: hide unnecessary fiscal PDF regeneration"`.

### Task 4: Make invoice email delivery byte-safe and diagnosable

**Files:**
- Modify: `src/features/email/mailer.ts:96-135`
- Modify: `src/features/email/invoice-email.ts:10-13`
- Modify: `src/features/billing/service.ts:104-170`
- Modify: `src/features/billing/actions.ts:106-123`
- Test: `tests/unit/email-mailer.test.ts`
- Test: `tests/unit/billing-actions.test.ts`

**Interfaces:**
- `sendInvoiceMessage(input)` accepts `pdf: Uint8Array` and `xml?: Uint8Array`, and passes both as binary `Buffer` attachments.
- `sendInvoiceEmail` returns `{ recipient: string; folio: string }` and raises `AppError` with safe actionable messages for invalid recipient, missing PDF, missing SMTP or mail transport failure.

- [ ] **Step 1: Add failing mailer tests.**

  Create `tests/unit/email-mailer.test.ts`, mock only Nodemailer transport creation, call `sendInvoiceMessage` with known PDF/XML bytes, and assert `sendMail` receives two attachments whose `content` buffers equal the original bytes. Add a test that missing SMTP configuration returns `SMTP_NOT_CONFIGURED` through `getMailTransport`.

- [ ] **Step 2: Run the email tests to verify RED.**

  Run `npx vitest run tests/unit/email-mailer.test.ts`. The binary XML test must fail against the current `xml?: string` contract/Latin-1 conversion.

- [ ] **Step 3: Implement binary attachment handling and safe transport errors.**

  Change the mailer XML input to `Uint8Array`, use `Buffer.from(input.xml)` without a charset, and keep the PDF binary conversion. Keep SMTP validation and map transport failures through `safeError` at the Server Action boundary without exposing credentials.

- [ ] **Step 4: Add a failing service/action coverage case.**

  Extend billing action tests so `sendInvoiceEmailAction` passes the selected custom address and returns the recipient, and add service-level coverage that the mailer receives the stored XML bytes rather than a Latin-1 string. Use existing DB/evidence mocks; do not call a live SMTP server.

- [ ] **Step 5: Run the focused email/action tests.**

  Run `npx vitest run tests/unit/email-mailer.test.ts tests/unit/billing-actions.test.ts`. Expected result: all pass.

- [ ] **Step 6: Commit the email fix.**

  Run `git diff --check`, then commit with `git add src/features/email/mailer.ts src/features/email/invoice-email.ts src/features/billing/service.ts src/features/billing/actions.ts tests/unit/email-mailer.test.ts tests/unit/billing-actions.test.ts && git commit -m "fix: send invoice evidence as binary attachments"`.

### Task 5: Allow direct invoice issuance from Orders

**Files:**
- Modify: `src/features/billing/emission.ts:2,212-249,351`
- Modify: `src/features/billing/service.ts:72-75`
- Modify: `src/features/billing/actions.ts:15-25`
- Modify: `src/app/(dashboard)/facturacion/page.tsx:1-13`
- Modify: `src/app/(dashboard)/ordenes/order-manager.tsx:4-8,226-300`
- Modify: `src/app/(dashboard)/ordenes/page.tsx:1-15` only if prop mapping needs adjustment
- Test: `tests/unit/fiscal-orchestration.test.ts`
- Test: `tests/unit/orders-ui.test.ts`

**Interfaces:**
- `issueInvoice(orderId, userId, gateway?)` accepts source order status `issued` or `paid`; all other statuses still raise `NOT_INVOICEABLE`.
- `issueInvoiceAction` revalidates `/facturacion`, `/ordenes`, and `/` after a direct order-table emission.
- `OrderManager` renders the existing `issueInvoiceAction` modal for `issued` and `paid` rows and keeps payment registration as an independent action.

- [ ] **Step 1: Add the failing service test for an unpaid issued order.**

  In `tests/unit/fiscal-orchestration.test.ts`, make the configured order status `issued` for a new test, invoke `issueInvoice` with the existing fake gateway, and assert the provider is called and the returned result is issued. Add an assertion that an accepted result updates the order with `{ status: "invoiced" }` even though it was not `paid`.

- [ ] **Step 2: Run the orchestration test and verify RED.**

  Run `npx vitest run tests/unit/fiscal-orchestration.test.ts`. It must fail with the current `NOT_INVOICEABLE` guard or fail to update `issued` orders because the current SQL condition only matches `paid`.

- [ ] **Step 3: Implement the order-status and list changes.**

  Import `inArray` in `emission.ts`, allow `issued`/`paid`, and replace every accepted-status order update predicate with `inArray(paymentOrders.status, ["issued", "paid"])`. Change `listPaidOrdersWithoutInvoice` to return both statuses and update its name/call site if necessary so Facturación does not hide eligible orders.

- [ ] **Step 4: Add the direct Orders UI test.**

  Create `tests/unit/orders-ui.test.ts` using `renderToStaticMarkup` and mocked action dependencies. Assert an `issued` row contains an accessible `Emitir factura` action and `Registrar pago`; assert an `invoiced` row contains neither direct invoice action nor payment registration.

- [ ] **Step 5: Implement the direct Server Action and modal.**

  Reuse `issueInvoiceAction` from `order-manager.tsx`, add the invoice icon/modal for `issued` and `paid`, and revalidate `/ordenes` in addition to `/facturacion` and `/`. Keep the order row’s payment action unchanged and make the invoice modal state its SII-pending outcome accurately.

- [ ] **Step 6: Run the focused order tests.**

  Run `npx vitest run tests/unit/fiscal-orchestration.test.ts tests/unit/orders-ui.test.ts tests/unit/billing-actions.test.ts`. Expected result: all pass.

- [ ] **Step 7: Commit the direct order invoicing flow.**

  Run `git diff --check`, then commit with `git add src/features/billing/emission.ts src/features/billing/service.ts src/features/billing/actions.ts src/app/(dashboard)/facturacion/page.tsx src/app/(dashboard)/ordenes/order-manager.tsx src/app/(dashboard)/ordenes/page.tsx tests/unit/fiscal-orchestration.test.ts tests/unit/orders-ui.test.ts && git commit -m "feat: issue invoices directly from orders"`.

### Task 6: Full verification and handoff

**Files:**
- Modify: none unless verification exposes a regression
- Inspect: all files changed by Tasks 1-5

- [ ] **Step 1: Re-read the design and plan checklists.**

  Confirm every objective has an implementation and a focused test, including byte preservation, PDF visual QA, conditional regeneration, email attachments, direct order issuance and accepted-only `invoiced` transition.

- [ ] **Step 2: Run the complete automated suite.**

  Run `npm test`. Record the exact passed/skipped/failed counts; if anything fails, fix it with a new failing regression test before proceeding.

- [ ] **Step 3: Run static checks.**

  Run `npm run typecheck` and `npm run lint`. Both must exit with code 0.

- [ ] **Step 4: Run the production build.**

  Run `npm run build`. Confirm the local Next.js build completes and note any expected database bootstrap message without treating it as a test failure.

- [ ] **Step 5: Review the final diff and repository state.**

  Run `git diff HEAD~5..HEAD --stat` (or the equivalent range if commit count differs), `git status --short`, and `git diff --check`. Remove only temporary PDF PNGs and leave source/tests/spec/plan commits intact.

- [ ] **Step 6: Use the finishing-a-development-branch skill.**

  Announce the finishing skill, run its required fresh full test, and present the exact integration options before merging/pushing/keeping the branch.
