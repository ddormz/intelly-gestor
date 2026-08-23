# Regeneración tributaria e ítems libres en órdenes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Regenerate the latest issued fiscal PDF, expose safe PDF regeneration, use the exact `Aceptado por SII` status label, and support taxable ad hoc order lines without catalog records.

**Architecture:** Reuse the existing signed-XML parser and evidence storage, adding a public regeneration service that always creates a new PDF evidence version. Extend the existing order cart contract with nullable `catalogItemId` and a server-validated description for ad hoc lines; persist those lines in the already-nullable `payment_order_lines.catalog_item_id`. Keep catalog resolution, fiscal calculations, optimistic concurrency, and existing order transitions unchanged.

**Tech Stack:** Next.js 16 App Router, React client components, TypeScript, Server Actions, Drizzle ORM/MySQL, Zod, Vitest, lucide-react.

## Global Constraints

- The accepted status accessible label must be exactly `Aceptado por SII`.
- A free line is scoped to one order and must never create or modify a catalog item.
- A free line starts with quantity `1`, unit price `0`, and taxable IVA rate `19`.
- The server must validate free-line descriptions and force the free-line tax rate to `19`, ignoring client-supplied tax values.
- PDF regeneration must preserve the invoice folio, signed XML, provider identifiers, and SII fields.
- PDF regeneration must create a new evidence version and keep the invoice issued if reconstruction fails.
- No database migration is expected: `payment_order_lines.catalog_item_id` is already nullable.
- Do not trust client-calculated totals, descriptions of catalog items, catalog prices, or catalog tax rates.
- Run focused tests after each task and commit each independently testable task.

---

### Task 1: Add a repeatable invoice PDF regeneration service and server action

**Files:**
- Modify: `src/features/billing/emission.ts`
- Modify: `src/features/billing/actions.ts`
- Create: `tests/unit/fiscal-regeneration.test.ts`

**Interfaces:**
- Consumes: `getFiscalEvidenceArtifact`, `parseSignedDteXmlBytes`, `renderFiscalPdf`, `storeReconstructedPdf`, `refreshInvoiceStatus`, `invoices`, and the existing authenticated Server Action conventions.
- Produces: `regenerateInvoicePdf(invoiceId: string, userId: string, gateway?: IntellyDteGateway): Promise<InvoiceResult>` and `regenerateInvoicePdfAction(_: ActionState, formData: FormData): Promise<ActionState>`.

- [ ] **Step 1: Write failing unit tests for regeneration with an existing XML**

Add a focused test module that mocks the database, XML parser/renderer, evidence lookup/storage, and audit insert. Cover these assertions:

```ts
it("creates a new reconstructed PDF even when the invoice already has one", async () => {
  const result = await regenerateInvoicePdf("invoice-id", "user-id");

  expect(renderFiscalPdf).toHaveBeenCalledWith(parsedDocument);
  expect(storeReconstructedPdf).toHaveBeenCalledWith(
    "invoice-id",
    { dteType: "33", folio: 42, rendererVersion: "fiscal-pdf-v2" },
    expect.any(Uint8Array),
  );
  expect(db.update).toHaveBeenCalledWith(expect.objectContaining({
    reconstructedPdfEvidenceId: "new-pdf-id",
    evidenceStatus: "complete",
    evidenceError: null,
    lastErrorCode: null,
    lastErrorMessage: null,
  }));
  expect(result).toMatchObject({ kind: "issued", providerDocumentId: "dte-1", folio: "42" });
});
```

Also cover that a renderer failure updates `evidenceStatus: "failed"`, records the safe error code/message, and throws an `AppError` without changing invoice status; cover missing XML by delegating to provider reconciliation.

- [ ] **Step 2: Run the focused tests and verify the RED state**

Run:

```bash
npm test -- tests/unit/fiscal-regeneration.test.ts
```

Expected: FAIL because `regenerateInvoicePdf` and `regenerateInvoicePdfAction` do not yet exist.

- [ ] **Step 3: Implement the regeneration service**

Refactor the existing local retry path into an exported service without changing its parser/render/storage behavior:

```ts
export async function regenerateInvoicePdf(
  invoiceId: string,
  userId: string,
  gateway?: IntellyDteGateway,
): Promise<InvoiceResult> {
  const db = getDb();
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1).execute();
  if (!invoice) throw new AppError("INVOICE_NOT_FOUND", "Factura no encontrada.", 404);
  if (invoice.status !== "issued") throw new AppError("INVOICE_NOT_ISSUED", "La factura debe estar emitida para regenerar su PDF.", 409);

  if (!invoice.signedXmlEvidenceId) {
    return refreshInvoiceStatus(invoiceId, userId, gateway);
  }

  try {
    const reconstructed = await retryLocalPdf(invoice.id);
    await db.update(invoices).set({
      reconstructedPdfEvidenceId: reconstructed.id,
      evidenceStatus: "complete",
      evidenceError: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      updatedAt: new Date(),
    }).where(eq(invoices.id, invoice.id));
    await db.insert(auditEvents).values(buildAuditEvent({
      actorUserId: userId,
      actorType: "user",
      action: "invoice.pdf_reconstructed",
      entityType: "invoice",
      entityId: invoice.id,
      metadata: { providerDocumentId: invoice.providerDocumentId, folio: invoice.folio, manual: true },
    }));
    return { kind: "issued", providerDocumentId: invoice.providerDocumentId ?? "", folio: invoice.folio ?? "", issuedAt: invoice.issuedAt?.toISOString() ?? new Date().toISOString(), trackId: invoice.trackId, siiStatus: invoice.siiStatus, siiGlosa: invoice.siiGlosa };
  } catch (error) {
    const safe = error instanceof AppError ? error : new AppError("PDF_RECONSTRUCTION_FAILED", "No se pudo reconstruir el PDF fiscal.", 500);
    await db.update(invoices).set({ evidenceStatus: "failed", evidenceError: safe.message.slice(0, 300), lastErrorCode: safe.code, lastErrorMessage: safe.message.slice(0, 300), updatedAt: new Date() }).where(eq(invoices.id, invoice.id));
    throw safe;
  }
}
```

Preserve the existing `refreshInvoiceStatus` behavior for missing XML/provider reconciliation and avoid re-emitting the invoice.

- [ ] **Step 4: Implement the authenticated Server Action**

Add an action that enforces same-origin, requires a logged-in user, validates the `invoiceId` string, calls `regenerateInvoicePdf`, revalidates `/facturacion`, and returns a safe Spanish message:

```ts
export async function regenerateInvoicePdfAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await enforceSameOrigin();
    const user = await requireUser();
    const invoiceId = String(formData.get("invoiceId") ?? "").trim();
    if (!invoiceId) return { status: "error", message: "Selecciona una factura válida." };
    const result = await regenerateInvoicePdf(invoiceId, user.userId);
    revalidatePath("/facturacion");
    return { status: "success", message: `PDF tributario regenerado para la Factura F${result.folio}.` };
  } catch (error) {
    return { status: "error", message: safeError(error).message };
  }
}
```

- [ ] **Step 5: Run the focused tests and typecheck**

Run:

```bash
npm test -- tests/unit/fiscal-regeneration.test.ts tests/unit/fiscal-orchestration.test.ts tests/unit/fiscal-webhook-persistence.test.ts
npm run typecheck
```

Expected: all focused tests pass and TypeScript reports no errors.

- [ ] **Step 6: Commit the regeneration service**

```bash
git add src/features/billing/emission.ts src/features/billing/actions.ts tests/unit/fiscal-regeneration.test.ts
git commit -m "feat: allow manual fiscal pdf regeneration"
```

### Task 2: Extend the order cart contract and server persistence for free taxable lines

**Files:**
- Modify: `src/features/orders/validation.ts`
- Modify: `src/features/orders/pos.ts`
- Modify: `src/features/orders/service.ts`
- Modify: `tests/unit/order-actions.test.ts`
- Modify: `tests/unit/order-pos.test.ts`

**Interfaces:**
- Consumes: the existing `OrderCartInput`, `OrderLineInput`, `createOrderFromCart`, `updateOrderFromCart`, and nullable `paymentOrderLines.catalogItemId`.
- Produces: cart lines shaped as `{ catalogItemId: string | null; description?: string; quantity: number; unitPrice: number }`; custom lines become taxable server-side `OrderLineInput` values with `taxRate: 19`.

- [ ] **Step 1: Add failing validation and persistence tests**

Add tests that assert:

```ts
expect(orderCartSchema.safeParse({
  clientId,
  lines: [{ catalogItemId: null, description: "Instalación especial", quantity: 1, unitPrice: 0 }],
}).success).toBe(true);

expect(orderCartSchema.safeParse({
  clientId,
  lines: [{ catalogItemId: null, description: " ", quantity: 1, unitPrice: 0 }],
}).success).toBe(false);
```

Use the existing transaction mock to verify a custom line is inserted with `catalogItemId: null`, the submitted description, `taxRate: "19"`, subtotal `0`, tax `0`, and total `0`. Add an update test that loads an existing custom line and persists its changed description and price. Add a cart serializer test that includes `description` only for custom lines and still excludes client-only `name`/`total` fields for catalog lines.

- [ ] **Step 2: Run the focused order tests and verify the RED state**

Run:

```bash
npm test -- tests/unit/order-actions.test.ts tests/unit/order-pos.test.ts
```

Expected: the new custom-line tests fail because the schema currently requires a catalog UUID and the service always queries the catalog.

- [ ] **Step 3: Update the validated cart contract**

Change the cart line schema to accept a nullable catalog ID and optional description, then require a trimmed description only when `catalogItemId` is null:

```ts
const cartLineSchema = z.object({
  catalogItemId: z.string().uuid().nullable(),
  description: z.string().trim().max(240).optional(),
  quantity: z.coerce.number().int().min(1).max(999),
  unitPrice: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
}).superRefine((line, context) => {
  if (line.catalogItemId === null && !line.description) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["description"], message: "Describe el ítem libre." });
  }
});
```

Keep catalog lines compatible with existing payloads by making the UI send `description` only for custom lines; the server must ignore `description` for catalog lines.

- [ ] **Step 4: Resolve catalog and custom lines separately on the server**

Change `resolveCartLines` to branch before the catalog query:

```ts
if (line.catalogItemId === null) {
  resolved.push({
    item: null,
    line: {
      code: null,
      description: line.description!,
      quantity: line.quantity,
      unitPrice: clp(line.unitPrice),
      taxRate: 19,
      taxCategory: "taxable",
    },
  });
  continue;
}
```

Retain the current locked catalog lookup and price policy for non-null IDs. Update the resolved type to allow `item: null`, and use `resolved[index]?.item?.taxRate ?? String(line.taxRate)` when inserting both new and updated lines. Persist `catalogItemId: line.catalogItemId ?? null`, so custom lines remain detached from the catalog. Do not accept a client tax rate for custom lines.

- [ ] **Step 5: Include custom lines in edit hydration and public-data comparison**

Keep every persisted line in `findOrderForEdit`, including rows whose `catalogItemId` is null. Ensure `orderPublicDataChanged` compares null IDs, descriptions, quantity, unit price, tax rate, subtotal, tax, and total exactly as it already does for catalog lines. Existing optimistic version and public-token rotation behavior must remain unchanged.

- [ ] **Step 6: Update cart serialization**

Update `PosDraftLine` and `buildOrderCartPayload` so catalog lines remain authoritative by ID while custom lines send the user description:

```ts
export type PosDraftLine = {
  catalogItemId: string | null;
  quantity: number;
  unitPrice: number;
  name?: string;
  total?: number;
};

export function buildOrderCartPayload(draft: PosDraft) {
  return {
    clientId: draft.clientId,
    lines: draft.lines.map(({ catalogItemId, quantity, unitPrice, name }) => ({
      catalogItemId,
      ...(catalogItemId === null ? { description: name?.trim() ?? "" } : {}),
      quantity,
      unitPrice,
    })),
    discountPercent: draft.discountPercent,
    discountReason: draft.discountReason,
    dueAt: draft.dueAt,
    notes: draft.notes,
    expectedVersion: draft.expectedVersion,
  };
}
```

- [ ] **Step 7: Run order tests and typecheck**

```bash
npm test -- tests/unit/order-actions.test.ts tests/unit/order-pos.test.ts tests/unit/order-domain.test.ts
npm run typecheck
```

Expected: all order tests pass and TypeScript reports no errors.

- [ ] **Step 8: Commit the order contract**

```bash
git add src/features/orders/validation.ts src/features/orders/pos.ts src/features/orders/service.ts tests/unit/order-actions.test.ts tests/unit/order-pos.test.ts
git commit -m "feat: support taxable free lines in orders"
```

### Task 3: Add the free-line editor to the order UI

**Files:**
- Modify: `src/app/(dashboard)/ordenes/nueva/order-pos.tsx`
- Modify: `src/app/(dashboard)/ordenes/[id]/editar/page.tsx`
- Modify: `tests/unit/order-pos.test.ts`

**Interfaces:**
- Consumes: the nullable cart contract from Task 2 and `OrderPosInitial.lines` from `findOrderForEdit`.
- Produces: a client-side order editor where `Agregar ítem libre` creates an editable taxable line with a stable UI key and the save form serializes it through `buildOrderCartPayload`.

- [ ] **Step 1: Write the failing UI serialization assertion**

Extend `tests/unit/order-pos.test.ts` with a custom-line case:

```ts
expect(buildOrderCartPayload({
  clientId: "client-id",
  lines: [{ catalogItemId: null, quantity: 1, unitPrice: 0, name: "Instalación especial", total: 9999 }],
  discountPercent: 0,
  discountReason: "",
})).toMatchObject({
  lines: [{ catalogItemId: null, description: "Instalación especial", quantity: 1, unitPrice: 0 }],
});
```

- [ ] **Step 2: Run the UI contract test and verify the RED state**

```bash
npm test -- tests/unit/order-pos.test.ts
```

Expected: the new assertion fails until the client contract is updated.

- [ ] **Step 3: Hydrate and identify custom lines**

Update `OrderPosInitial.lines` to include `id?: string` and stop filtering out rows with `catalogItemId: null`. Build `PosLine` values with a stable `rowKey`: persisted `id`, catalog ID, or `crypto.randomUUID()` for newly created custom rows. Make `PosLine.catalogItemId` nullable and keep `taxRate: 19`/`taxCategory: "taxable"` for custom rows.

- [ ] **Step 4: Add the free-line action and editable row**

Add a `Plus` icon button labeled `Agregar ítem libre` beside the catalog search. Its handler appends:

```ts
{
  rowKey: crypto.randomUUID(),
  catalogItemId: null,
  code: "",
  name: "",
  quantity: 1,
  unitPrice: 0,
  taxRate: 19,
  taxCategory: "taxable",
}
```

For custom rows, render an editable description `Input` with `required`, an IVA 19% indicator, quantity input, price input initialized at 0, and the existing remove action. Catalog rows retain their current read-only description/code display and catalog behavior. Use `rowKey` instead of `catalogItemId` for React keys and update/remove lookups so multiple custom rows work.

- [ ] **Step 5: Prevent accidental save of an unnamed custom row**

Compute `freeLineNeedsDescription = lines.some((line) => line.catalogItemId === null && !line.name?.trim())` and disable the save button when true. Keep the server-side validation as the authoritative guard. Keep the existing `!draft.lines.length` and discount/client guards.

- [ ] **Step 6: Preserve custom lines during edit hydration**

Map `findOrderForEdit` lines in `src/app/(dashboard)/ordenes/[id]/editar/page.tsx` so each line passes its database `id` to `OrderPosInitial`. Do not create catalog records or alter catalog search results.

- [ ] **Step 7: Run UI tests, lint, and typecheck**

```bash
npm test -- tests/unit/order-pos.test.ts tests/unit/order-actions.test.ts
npm run lint
npm run typecheck
```

Expected: all selected tests, lint, and typecheck pass.

- [ ] **Step 8: Commit the order UI**

```bash
git add "src/app/(dashboard)/ordenes/nueva/order-pos.tsx" "src/app/(dashboard)/ordenes/[id]/editar/page.tsx" tests/unit/order-pos.test.ts
git commit -m "feat: add editable free line to order editor"
```

### Task 4: Update billing status copy and expose regeneration controls

**Files:**
- Modify: `src/app/(dashboard)/facturacion/billing-manager.tsx`
- Modify: `tests/unit/billing-ui.test.ts`

**Interfaces:**
- Consumes: `regenerateInvoicePdfAction` from Task 1 and the existing `InvoiceItem` fields.
- Produces: an icon-only manual PDF regeneration action for issued invoices and the exact accessible accepted label.

- [ ] **Step 1: Add failing billing UI assertions**

Update the billing UI test to assert the exact copy and action:

```ts
const html = renderInvoice("issued", true, true);
expect(html).toContain('aria-label="Aceptado por SII"');
expect(html).not.toContain('aria-label="Aceptado por el SII"');
expect(html).toContain("Regenerar PDF tributario");
```

- [ ] **Step 2: Run the billing UI test and verify the RED state**

```bash
npm test -- tests/unit/billing-ui.test.ts
```

Expected: FAIL because the current label includes `el` and no manual regeneration action is rendered when the PDF already exists.

- [ ] **Step 3: Update the icon label and add the action modal**

Change the accepted presentation label to exactly `Aceptado por SII`. Import `regenerateInvoicePdfAction` and render an icon-only `ActionModal` for every issued invoice, including invoices that already have both artifacts:

```tsx
{item.status === "issued" ? (
  <ActionModal
    iconOnly
    triggerLabel="Regenerar PDF tributario"
    triggerIcon={<RefreshCw size={17} />}
    title="Regenerar PDF tributario"
    description="Se reconstruirá una nueva versión del PDF usando el XML firmado, sin cambiar el folio."
    submitLabel="Regenerar PDF"
    pendingLabel="Regenerando PDF…"
    action={regenerateInvoicePdfAction}
  >
    {() => <input type="hidden" name="invoiceId" value={item.id} />}
  </ActionModal>
) : null}
```

Keep the existing missing-artifact reconciliation action and download/email actions. Do not add a visible status column or status text beside the folio.

- [ ] **Step 4: Run billing tests, lint, and typecheck**

```bash
npm test -- tests/unit/billing-ui.test.ts tests/unit/fiscal-regeneration.test.ts
npm run lint
npm run typecheck
```

- [ ] **Step 5: Commit billing UI changes**

```bash
git add "src/app/(dashboard)/facturacion/billing-manager.tsx" tests/unit/billing-ui.test.ts
git commit -m "feat: expose invoice pdf regeneration action"
```

### Task 5: Regenerate the latest invoice and perform final verification

**Files:**
- No source files expected unless a verification failure identifies a required fix.
- Read-only operational query and the already committed regeneration service.

**Interfaces:**
- Consumes: `regenerateInvoicePdf` from `src/features/billing/emission.ts`, current database configuration, and the authenticated operational environment.
- Produces: a new reconstructed PDF evidence version for the latest issued invoice, or an explicit non-mutating environment limitation.

- [ ] **Step 1: Check database availability without exposing credentials**

Run a boolean-only environment check and do not print `DATABASE_URL` or API keys:

```powershell
if ($env:DATABASE_URL) { "DATABASE_URL configured" } else { "DATABASE_URL missing" }
```

If the variable is missing, record the limitation and skip the mutation; the remaining automated verification still runs.

- [ ] **Step 2: Select the latest issued invoice and regenerate it when configured**

When `DATABASE_URL` is available, use a `tsx` one-off invocation that imports the service, selects the latest issued invoice by `issuedAt`, `createdAt`, and `id`, and calls `regenerateInvoicePdf` with the current operational user ID. Print only invoice ID, folio, and returned result kind. Do not reissue or modify provider data.

The operational check must fail if no issued invoice exists, if the service does not return `kind: "issued"`, or if the new PDF evidence ID is absent after the call.

- [ ] **Step 3: Run the complete verification suite**

```bash
npm test
npm run typecheck
npm run lint
npm run build
git diff HEAD --check
git status --short
```

Expected: all tests pass, typecheck/lint/build exit successfully, `git diff HEAD --check` emits no whitespace errors, and `git status --short` is empty.

- [ ] **Step 4: Review the final diff against the specification**

Confirm each requirement in `docs/superpowers/specs/2026-08-22-billing-regeneration-free-order-lines-design.md` has an implementation and test. Specifically verify no catalog insert exists in the custom-line path, the accepted label is exact, and regeneration creates a new evidence version even when a previous PDF exists.

- [ ] **Step 5: Commit any required verification-only fix**

If and only if a source fix is required by the verification output, add its focused test first, then commit it with a message describing the specific fix. Otherwise leave the previously committed source unchanged and report the verification results.
