# Billing PDF, Status and Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate the local fiscal PDF automatically from signed DTE XML, present fiscal status as a Bevox-style icon beside the folio, and remove remote folio loading from the critical Facturación render path.

**Architecture:** Extract one evidence-materialization service used by immediate emission, webhook reconciliation, and no-reissue recovery. Keep fiscal acceptance state independent from artifact state. Split the Facturación UI into a critical server-rendered document view and a client-loaded folio panel with skeletons and an authenticated no-store route.

**Tech Stack:** TypeScript, Next.js App Router Server Actions/Route Handlers, React, Drizzle/MySQL, Vitest, Playwright, jsPDF, jspdf-autotable, bwip-js, fast-xml-parser, Tailwind utility classes and Lucide icons.

## Global Constraints

- Node.js must be >=22 as declared in package.json.
- Read the installed Next.js guides before changing code: node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-server.md and node_modules/next/dist/docs/01-app/02-guides/server-actions.md.
- Production code must be preceded by a focused failing test and then implemented in the smallest passing change.
- The signed XML from printPayload.signedXmlBase64 is the fiscal source of truth; provider pdf, pdfUrl, and physical-PDF flags are ignored.
- An accepted invoice remains status: issued when artifact generation fails or is pending.
- Evidence recovery must never call issueInvoice or allocate a new folio.
- Signed XML, TED, Base64, PDF bytes, API keys and provider bodies must not be logged or exposed by the folio route.
- The Facturación page must not await getFoliosStatus() during its initial server render.
- No database migration is expected; existing invoice evidence columns and indexes remain the persistence contract.
- Verify each task with its focused command before moving to the next task.

---

## File Map

### New files

- src/features/billing/evidence-orchestration.ts: typed XML-to-evidence boundary.
- src/app/(dashboard)/facturacion/fiscal-status-icon.tsx: accessible icon-only status presentation.
- src/app/(dashboard)/facturacion/folio-status-panel.tsx: client folio fetch, skeleton, retry and sync UI.
- src/app/api/integrations/intellydte/folios/route.ts: authenticated no-store folio status endpoint.
- src/app/(dashboard)/facturacion/loading.tsx: route-level loading shell for Facturación.
- tests/unit/evidence-orchestration.test.ts: materialization contract tests.
- tests/unit/billing-presentation.test.ts: pure fiscal status mapping tests.
- tests/unit/billing-folios.test.ts: folio route/panel and initial-render tests.

### Modified files

- src/features/billing/emission.ts: consume the shared materializer for issue, webhook and retry paths.
- src/app/(dashboard)/facturacion/billing-manager.tsx: remove the status column, place the icon beside the folio, and mount the folio panel.
- src/app/(dashboard)/facturacion/page.tsx: remove the gateway folio call from the critical Promise.all.
- src/features/billing/actions.ts: remove only obsolete folio-loading wiring if the client panel owns synchronization; preserve invoice and CAF actions.
- tests/unit/fiscal-orchestration.test.ts: verify issue and recovery behavior.
- tests/unit/fiscal-webhook-persistence.test.ts: verify webhook materialization and accepted-without-XML behavior.
- tests/unit/billing-ui.test.ts: replace text-badge assertions with icon-adjacency and accessibility assertions.
- tests/e2e/billing.spec.ts: cover visible folio skeleton/load state and the compact status location where the seeded fixture supports it.

---

## Task 1: Extract the fiscal evidence materialization boundary

**Files:**

- Create: src/features/billing/evidence-orchestration.ts
- Create: tests/unit/evidence-orchestration.test.ts
- Read/Reuse: src/features/billing/xml.ts, src/features/billing/evidence.ts, src/features/billing/emission.ts

**Interfaces:**

    export type EvidenceMaterializationResult = {
      status: "pending" | "complete" | "failed";
      signedXmlEvidenceId: string | null;
      reconstructedPdfEvidenceId: string | null;
      errorCode: string | null;
      errorMessage: string | null;
    };

    export type MaterializeInvoiceEvidenceInput = {
      invoiceId: string;
      result: Extract<InvoiceResult, { kind: "issued" }>;
      payload: IntellyDteFacturaPayload;
      expectedIssuerRut?: string | null;
    };

    export async function materializeInvoiceEvidence(
      input: MaterializeInvoiceEvidenceInput,
    ): Promise<EvidenceMaterializationResult>;

- [ ] **Step 1: Install dependencies when node_modules is absent and read the Next.js guides**

Run:

    npm ci
    Get-Content -Raw node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-server.md
    Get-Content -Raw node_modules/next/dist/docs/01-app/02-guides/server-actions.md

Expected: dependency installation exits with code 0 and both guides are read completely. Preserve the project’s Server Action authorization and validation boundaries.

- [ ] **Step 2: Write the failing materialization tests**

Add tests that mock only storage/render boundaries and use a synthetic signed XML fixture:

    it("stores XML and generates the fiscal PDF for an issued response", async () => {
      const result = await materializeInvoiceEvidence({
        invoiceId: "invoice-101",
        result: {
          kind: "issued",
          providerDocumentId: "dte-101",
          folio: "22",
          tipoDte: "33",
          issuedAt: "2026-08-22T12:00:00.000Z",
          signedXmlBase64: Buffer.from(validSignedXml).toString("base64"),
        },
        payload: validFacturaPayload,
        expectedIssuerRut: "76123456-7",
      });

      expect(result).toEqual({
        status: "complete",
        signedXmlEvidenceId: "xml-evidence-101",
        reconstructedPdfEvidenceId: "pdf-evidence-101",
        errorCode: null,
        errorMessage: null,
      });
    });

    it("keeps the XML id and reports a retryable PDF failure", async () => {
      mockRenderFiscalPdf.mockRejectedValueOnce(new Error("renderer failed"));
      const result = await materializeInvoiceEvidence(validInput);

      expect(result).toMatchObject({
        status: "failed",
        signedXmlEvidenceId: "xml-evidence-101",
        reconstructedPdfEvidenceId: null,
        errorCode: "PDF_RECONSTRUCTION_FAILED",
      });
    });

    it("returns pending without writing artifacts when signed XML is absent", async () => {
      const result = await materializeInvoiceEvidence({
        ...validInput,
        result: { ...validInput.result, signedXmlBase64: undefined },
      });

      expect(result).toMatchObject({
        status: "pending",
        signedXmlEvidenceId: null,
        reconstructedPdfEvidenceId: null,
        errorCode: "SIGNED_XML_PENDING",
      });
    });

- [ ] **Step 3: Run the focused tests and verify the expected RED failure**

Run: npm test -- tests/unit/evidence-orchestration.test.ts

Expected: FAIL because evidence-orchestration.ts and materializeInvoiceEvidence do not exist yet. Fix test setup errors until the failure is specifically about the missing implementation.

- [ ] **Step 4: Implement the minimal materializer**

Move the current Base64 decoding and provider/order validation currently held by materializeEvidence and assertProviderMatchesOrder into the new module. Implement this exact sequence:

1. Return pending with SIGNED_XML_PENDING when signedXmlBase64 is empty.
2. Reject malformed Base64 with SIGNED_XML_INVALID without logging its value.
3. Parse bytes with parseSignedDteXmlBytes and validate DTE type, folio, issuer, receiver, totals, date and details against payload.
4. Call storeSignedXmlBytes with the original bytes.
5. Call renderFiscalPdf with the parsed document.
6. Call storeReconstructedPdf with rendererVersion: "fiscal-pdf-v2".
7. Return complete only when both evidence IDs exist.
8. On PDF failure, return failed with the XML ID and a safe stable error code; do not convert the invoice state here.

- [ ] **Step 5: Run the focused tests and typecheck**

Run:

    npm test -- tests/unit/evidence-orchestration.test.ts
    npm run typecheck

Expected: all focused tests pass and TypeScript reports no errors.

- [ ] **Step 6: Commit the isolated materializer**

    git add -- src/features/billing/evidence-orchestration.ts tests/unit/evidence-orchestration.test.ts
    git commit -m "refactor: isolate fiscal evidence materialization"

## Task 2: Use the materializer for emission and webhook flows

**Files:**

- Modify: src/features/billing/emission.ts
- Modify: tests/unit/fiscal-orchestration.test.ts
- Modify: tests/unit/fiscal-webhook-persistence.test.ts

**Interfaces:**

- applyInvoiceResult consumes EvidenceMaterializationResult and owns the invoice/order/integration-attempt transaction.
- issueInvoice keeps the stable idempotency key invoice:<orderId>.
- handleIntellyDteWebhook invokes the same materializer when the webhook contains signed XML.

- [ ] **Step 1: Add regression assertions before changing emission code**

Extend tests/unit/fiscal-orchestration.test.ts so an issued response with signed XML asserts:

    expect(storeSignedXmlBytes).toHaveBeenCalledWith(
      "invoice-1",
      expect.any(Object),
      expect.any(Uint8Array),
    );
    expect(storeReconstructedPdf).toHaveBeenCalledWith(
      "invoice-1",
      expect.objectContaining({ rendererVersion: "fiscal-pdf-v2" }),
      expect.any(Uint8Array),
    );
    expect(updates).toContainEqual(expect.objectContaining({ evidenceStatus: "complete" }));

Extend tests/unit/fiscal-webhook-persistence.test.ts so an accepted webhook with printPayload.signedXmlBase64 stores both artifacts and an accepted webhook without XML leaves evidenceStatus: "pending" while keeping status: "issued".

- [ ] **Step 2: Run the focused tests and verify RED or the missing assertion**

Run:

    npm test -- tests/unit/fiscal-orchestration.test.ts tests/unit/fiscal-webhook-persistence.test.ts

Expected: the new PDF/materialization assertions fail against the old inline flow or expose the current mock/transaction mismatch. Do not change production code until the regression is demonstrated.

- [ ] **Step 3: Replace inline materialization in emission.ts**

Remove the duplicate decodeProviderXml, materializeEvidence and local PDF reconstruction logic after moving any still-needed validation into the new module. In applyInvoiceResult:

- call materializeInvoiceEvidence only for result.kind === "issued";
- set signedXmlEvidenceId and reconstructedPdfEvidenceId from the structured result;
- set evidenceStatus to complete only for a complete result, otherwise pending/failed without changing fiscal acceptance;
- update paymentOrders.status to invoiced only when the fiscal result is issued;
- record a safe integration message and audit metadata containing IDs/status only;
- keep terminal local issued/rejected precedence and never create a second provider request for uncertain results.

When a stored XML exists and only the PDF is missing, use the same parser/renderer boundary to rebuild the PDF. The recovery path may call getInvoiceStatus once when XML is absent, but it must not call issueInvoice.

- [ ] **Step 4: Run the focused tests and typecheck**

Run:

    npm test -- tests/unit/fiscal-orchestration.test.ts tests/unit/fiscal-webhook-persistence.test.ts tests/unit/evidence-orchestration.test.ts
    npm run typecheck

Expected: all fiscal orchestration tests pass, including immediate PDF generation, webhook generation, pending XML and no-reissue recovery.

- [ ] **Step 5: Commit the emission integration**

    git add -- src/features/billing/emission.ts tests/unit/fiscal-orchestration.test.ts tests/unit/fiscal-webhook-persistence.test.ts
    git commit -m "fix: generate fiscal pdf during invoice materialization"

## Task 3: Replace the status column with a Bevox-style fiscal icon

**Files:**

- Create: src/features/billing/presentation.ts
- Create: src/app/(dashboard)/facturacion/fiscal-status-icon.tsx
- Modify: src/app/(dashboard)/facturacion/billing-manager.tsx
- Modify: tests/unit/billing-ui.test.ts
- Create: tests/unit/billing-presentation.test.ts

**Interfaces:**

    export type FiscalStatusInput = {
      status: "pending" | "processing" | "issued" | "rejected" | string;
      siiStatus?: string | null;
      siiGlosa?: string | null;
    };

    export type FiscalStatusPresentation = {
      key: "accepted" | "sent" | "review" | "observed" | "rejected";
      label: string;
      icon: "badge-check" | "arrow-right" | "clock-3" | "triangle-alert" | "circle-x";
      tone: "success" | "info" | "warning" | "danger";
    };

    export function getFiscalStatusPresentation(
      input: FiscalStatusInput,
    ): FiscalStatusPresentation;

- [ ] **Step 1: Write failing pure mapping and rendered UI tests**

Assert the Bevox-compatible mapping:

    expect(getFiscalStatusPresentation({ status: "issued", siiStatus: "DOK" })).toEqual({
      key: "accepted",
      label: "Aceptada por el SII",
      icon: "badge-check",
      tone: "success",
    });

    expect(getFiscalStatusPresentation({ status: "processing", siiStatus: "ENQUEUED" }).key).toBe("sent");
    expect(getFiscalStatusPresentation({ status: "pending", siiStatus: "SOA" }).key).toBe("review");
    expect(getFiscalStatusPresentation({ status: "rejected", siiStatus: "RPR" }).key).toBe("rejected");

Render BillingManager with a folio and assert the folio cell contains the accessible status icon, the table has no Estado header, and no visible status badge text is rendered beside the folio. Keep existing tests that disabled artifact controls have no href and expose their reason.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: npm test -- tests/unit/billing-presentation.test.ts tests/unit/billing-ui.test.ts

Expected: FAIL because the pure presentation module does not exist and the table still has the status column/text badge.

- [ ] **Step 3: Implement the pure fiscal status presentation**

Normalize siiStatus case-insensitively using the local Bevox semantics:

- DOK, ACCEPTED, ACEPTADO → accepted;
- SOA, REVIEW, OBSERVED, OBSERVADO → review or observed as appropriate;
- RPR, REJECT, RECHAZADO, FAILED, ERROR → rejected;
- ENQUEUED, PENDING, local pending/processing → sent or review;
- local issued with no contradictory SII status → accepted.

Return Spanish labels and icon names only; do not embed JSX in the pure mapping.

- [ ] **Step 4: Implement the icon component**

Map icon names to Lucide components. Render a compact span with role="img", aria-label, title, tone class and aria-hidden="true" on the SVG. Render LoaderCircle with animate-spin only for active processing. Include siiGlosa in the title when present without placing it in the table cell as a status paragraph.

- [ ] **Step 5: Update the billing table**

In billing-manager.tsx:

- remove the Estado th and its td;
- keep the Folio column and render FiscalStatusIcon immediately before the folio;
- preserve the item’s fiscal action controls and icon-only behavior;
- keep siiGlosa available through the icon tooltip/accessible label;
- keep the status filter tabs and server-side status filtering unchanged.

- [ ] **Step 6: Run focused tests and typecheck**

Run:

    npm test -- tests/unit/billing-presentation.test.ts tests/unit/billing-ui.test.ts
    npm run typecheck

Expected: all mapping, rendered icon, table structure and disabled-action tests pass.

- [ ] **Step 7: Commit the compact status UI**

    git add -- src/features/billing/presentation.ts src/app/(dashboard)/facturacion/fiscal-status-icon.tsx src/app/(dashboard)/facturacion/billing-manager.tsx tests/unit/billing-presentation.test.ts tests/unit/billing-ui.test.ts
    git commit -m "feat: show fiscal status icon beside invoice folio"

## Task 4: Load folios after the critical page render with skeletons

**Files:**

- Create: src/app/api/integrations/intellydte/folios/route.ts
- Create: src/app/(dashboard)/facturacion/folio-status-panel.tsx
- Create: src/app/(dashboard)/facturacion/loading.tsx
- Modify: src/app/(dashboard)/facturacion/page.tsx
- Modify: src/app/(dashboard)/facturacion/billing-manager.tsx
- Modify: src/features/billing/actions.ts only if syncFoliosAction becomes unused
- Create: tests/unit/billing-folios.test.ts
- Modify: tests/e2e/billing.spec.ts

**Interfaces:**

    type FoliosResponse =
      | { success: true; data: FolioStatusItem[] }
      | { success: false; message: string };

    export function FolioStatusPanel(): JSX.Element;

- [ ] **Step 1: Write failing route, skeleton and server-render tests**

Add a route test that mocks requireUser and the gateway and expects GET to return the folio array with Cache-Control: no-store. Add a static-render test that expects three skeleton cards before the client effect runs:

    const html = renderToStaticMarkup(createElement(FolioStatusPanel));
    expect((html.match(/data-testid="folio-skeleton-card"/g) ?? []).length).toBe(3);

Add a page test that mocks listInvoices, listPaidOrdersWithoutInvoice, requireUser and getIntellyDteGateway, calls BillingPage, and asserts:

    expect(getIntellyDteGateway).not.toHaveBeenCalled();

- [ ] **Step 2: Run the focused tests and verify RED**

Run: npm test -- tests/unit/billing-folios.test.ts

Expected: FAIL because the folio route/panel do not exist and page.tsx still calls the gateway before rendering.

- [ ] **Step 3: Implement the authenticated folio route**

Create GET in src/app/api/integrations/intellydte/folios/route.ts:

1. Call requireUser before loading integration configuration.
2. Call getIntellyDteGateway().getFoliosStatus().
3. Return { success: true, data } with Cache-Control: no-store.
4. Catch errors with safeError and return { success: false, code, message, correlationId } with the safe status and the same no-store header.

Do not include gateway configuration or provider response bodies.

- [ ] **Step 4: Implement the client panel and skeletons**

Create a client component with loading, items, error and refresh state. On mount, fetch /api/integrations/intellydte/folios with cache: "no-store". Render exactly three pulse cards while loading, the real DTE 33/39/61 cards when loaded, and a retry button plus safe message on error. The manual “Sincronizar folios” action calls the same refresh function and updates only this component.

Move the existing folio card rendering from BillingManager into this panel, preserving requestFoliosAction modals and the existing count/range semantics.

- [ ] **Step 5: Remove folios from the initial server dependency graph**

In page.tsx:

- remove the getIntellyDteGateway import and call;
- change the critical Promise.all to [listInvoices(query), listPaidOrdersWithoutInvoice(), requireUser()];
- render BillingManager without a server folios prop.

In billing-manager.tsx, mount FolioStatusPanel in the same location and remove DirectSyncFoliosButton plus its now-unused sync import. Preserve all other page actions.

Add loading.tsx with a route-level shell containing a page header pulse, three folio-skeleton-card blocks and six table-row pulses so navigation gives immediate visual feedback while critical queries resolve.

- [ ] **Step 6: Remove only dead synchronization code and run focused tests**

If syncFoliosAction has no remaining callers, remove it from actions.ts; retain requestFoliosAction, issueInvoiceAction, refreshInvoiceStatusAction, sendInvoiceEmailAction and historical import behavior.

Run:

    npm test -- tests/unit/billing-folios.test.ts tests/unit/billing-ui.test.ts
    npm run typecheck

Expected: route response, three-card skeleton, no-server-gateway-call and integrated UI tests pass.

- [ ] **Step 7: Add the e2e loading contract**

In the authenticated billing e2e test, intercept /api/integrations/intellydte/folios, delay it, navigate to /facturacion, assert the Facturación heading/table is visible and the three folio skeleton cards are present before resolving the route, then resolve it and assert the folio cards appear. Keep the existing environment guard so the test remains skipped without an isolated account.

- [ ] **Step 8: Commit the deferred folio panel**

    git add -- src/app/api/integrations/intellydte/folios/route.ts src/app/(dashboard)/facturacion/folio-status-panel.tsx src/app/(dashboard)/facturacion/loading.tsx src/app/(dashboard)/facturacion/page.tsx src/app/(dashboard)/facturacion/billing-manager.tsx src/features/billing/actions.ts tests/unit/billing-folios.test.ts tests/e2e/billing.spec.ts
    git commit -m "perf: defer billing folio status loading"

## Task 5: Full verification and requirements review

**Files:**

- Verify all modified files from Tasks 1–4.
- Do not add provider payloads, real credentials or downloaded PDFs/XMLs to the repository.

- [ ] **Step 1: Run the complete quality gate**

Run each command independently:

    npm test
    npm run typecheck
    npm run lint
    npm run build
    git diff --check
    git status --short

Expected: Vitest has zero failures, typecheck/lint/build exit with code 0, git diff --check is clean, and status contains only intentional tracked commits or no uncommitted changes.

- [ ] **Step 2: Run the billing e2e suite**

Run: npx playwright test tests/e2e/billing.spec.ts

Expected: the test passes when E2E credentials/configuration are present; otherwise Playwright reports the existing isolated-account skip without treating it as a product failure.

- [ ] **Step 3: Review the implementation against the specification**

Verify all of the following with rg and the diff:

- storeReconstructedPdf is called for an issued response containing signed XML;
- webhook and immediate emission share the materializer;
- no evidence retry path calls issueInvoice;
- no code consumes provider pdf or pdfUrl for this flow;
- the Facturación table has no standalone Estado column;
- the status icon is adjacent to the folio and has title/aria-label;
- the initial page does not call getFoliosStatus;
- skeletons render three folio cards and the error state can retry;
- the folio route requires authentication and returns no-store headers;
- no XML, TED, Base64, PDF bytes or credentials are logged.

Commands:

    rg -n "getFoliosStatus|storeReconstructedPdf|issueInvoice|pdfUrl|signedXmlBase64|aria-label|folio-skeleton-card" src tests
    git diff --check

- [ ] **Step 4: Commit only reviewed follow-up fixes**

If verification finds an issue, add only the explicit corrected files and rerun the affected focused tests plus the full quality gate. Do not create an empty commit.
