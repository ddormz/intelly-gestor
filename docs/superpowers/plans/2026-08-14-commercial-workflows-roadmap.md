# Commercial Workflows Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement each child plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved commercial workflow, POS, fiscal XML/PDF, and integration-observability changes as independently verifiable phases.

**Architecture:** Execute five child plans in dependency order. Shared query/UI contracts land first, catalog and client data follows, then the order POS consumes those contracts, fiscal billing consumes order snapshots, and integration observability spans fiscal calls and webhooks.

**Tech Stack:** Next.js App Router, React, TypeScript, Drizzle ORM/MySQL, Zod, Tailwind CSS, jsPDF, jspdf-autotable, Nodemailer, Vitest, Playwright, and the local IntellyDTE/Bevox contracts under `C:\laragon\www`.

**Spec:** `docs/superpowers/specs/2026-08-14-commercial-workflows-and-fiscal-integration-design.md`

## Global Constraints

- Preserve Server Components and Server Actions as the primary architecture.
- All action triggers and buttons are icon-only with `aria-label` and hover/focus tooltips.
- Tables own their surface; do not wrap a table in a redundant outer `Card`.
- Interactive list state is validated server-side and stored in URL query parameters.
- The server is authoritative for validation, money calculations, state transitions, idempotency, and provider responses.
- Existing historical records are preserved; migrations are additive or explicitly backfilled.
- Signed XML from IntellyDTE is the fiscal source of truth; PDFs are always reconstructed in the gestor.
- API keys, webhook secrets, authorization headers, cookies, passwords, and tokens never enter client props or persisted logs.
- No commit, push, branch merge, or pull request is part of execution unless the user explicitly requests it.

## Execution Order

1. `2026-08-14-shared-ui-query-foundation.md`
2. `2026-08-14-catalog-clients.md`
3. `2026-08-14-payment-order-pos.md`
4. `2026-08-14-fiscal-billing-signed-xml.md`
5. `2026-08-14-integration-observability.md`

## Phase Gates

After each child plan:

```text
npm run lint
npm run typecheck
npm test
```

Run database-backed tests against isolated MySQL. Run Playwright only against the local test database and test account. Do not enable live IntellyDTE HTTP mode until the fiscal activation gate in the design spec is satisfied.

## Cross-Plan Interfaces

The plans must preserve these interfaces:

```ts
type PageQuery = {
  page: number;
  pageSize: number;
  q: string;
  status?: string;
  tab?: string;
};

type PageResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

type OrderTotals = {
  subtotal: bigint;
  discount: bigint;
  taxableBase: bigint;
  exemptBase: bigint;
  tax: bigint;
  total: bigint;
};

type SignedFiscalEvidence = {
  invoiceId: string;
  dteRecordId: string;
  tipoDte: string;
  folio: string;
  signedXmlStorageKey: string;
  signedXmlSha256: string;
  pdfStorageKey: string;
  pdfSha256: string;
  rendererVersion: number;
};
```

The implementation may refine these types only when the refinement is reflected in all dependent plans and tests.
