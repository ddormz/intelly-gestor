# Estado fiscal por webhook y artefactos tributarios locales — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reflejar automáticamente la aceptación o rechazo del SII desde los webhooks de IntellyDTE, sin depender de la disponibilidad de los archivos, y generar en Intelly Gestor el XML/PDF tributario descargable y enviable por correo.

**Architecture:** Normalizar primero las variantes reales del contrato de IntellyDTE; resolver el estado fiscal y el estado de evidencia como máquinas de estado separadas; correlacionar webhooks por el identificador único del proveedor con RUT opcional; extraer la materialización local de XML/PDF a un servicio reutilizable; y presentar estado y acciones mediante modelos de UI puros y accesibles. La factura aceptada nunca se reemite por una falla de artefactos.

**Tech Stack:** Next.js App Router, React, TypeScript, Drizzle ORM/MySQL, Vitest, lucide-react, fast-xml-parser, bwip-js, jsPDF y almacenamiento privado local de evidencia fiscal.

**Spec:** `docs/superpowers/specs/2026-08-22-fiscal-webhook-artifacts-status-design.md`

## Global Constraints

- No copiar al repositorio, fixtures, snapshots, logs ni commits el XML, TED, PDF417, RUT o Base64 reales entregados por el usuario.
- Las pruebas deben construir un XML sintético mínimo con RUTs y folios ficticios.
- `invoices.status` representa el estado fiscal; `invoices.evidenceStatus` representa sólo la disponibilidad de artefactos.
- Un `dte.accepted` válido debe dejar la factura en `issued` aunque no exista XML o PDF.
- La falla al decodificar, validar, persistir o renderizar evidencia no puede devolver la factura a `pending`, reemitirla ni cambiar el folio.
- No consumir los campos `pdf.letterAvailable` o `pdf.thermalAvailable` como PDF final. El PDF se reconstruye localmente desde el XML firmado y su TED.
- La correlación principal es `invoices.providerDocumentId`, que ya tiene índice único. El RUT recibido es una validación adicional opcional, no una clave obligatoria.
- Ninguna llamada HTTP, render de PDF o envío de email se ejecutará dentro de una transacción de base de datos.
- Antes de modificar Server Actions, leer `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-server.md` y `node_modules/next/dist/docs/01-app/02-guides/server-actions.md`, conforme a `AGENTS.md`.
- No se requiere migración de esquema: los estados y columnas necesarios ya existen. Si la implementación descubre una necesidad de esquema no descrita aquí, se detiene esa tarea y se actualiza primero la especificación y este plan.
- Cada tarea sigue rojo-verde-refactor, ejecuta sus pruebas focalizadas y crea un commit independiente sin incluir `.worktrees/`.
- La reparación de la factura real, el envío de un correo real y el despliegue a producción son operaciones separadas y requieren autorización explícita antes de ejecutarse.

## File and Interface Map

- `src/features/integrations/intellydte-contract.ts`: normaliza `{ data }`, `{ body: { data } }` y payload directo; expone `providerData()` y el contrato de `printPayload`.
- `src/features/integrations/intellydte.ts`: convierte la respuesta normalizada a `InvoiceEmissionResult` sin exigir PDF del proveedor.
- `src/features/billing/fiscal-state.ts`: funciones puras para precedencia de eventos y separación estado fiscal/evidencia.
- `src/features/billing/evidence-orchestration.ts`: valida XML, lo guarda, renderiza PDF local y devuelve un resultado estructurado sin alterar el estado fiscal.
- `src/features/billing/emission.ts`: coordina emisión, refresco y webhooks usando los dos servicios anteriores.
- `src/features/billing/service.ts`: reintenta artefactos sin reemitir y conserva las restricciones de correo.
- `src/features/billing/actions.ts`: Server Action de reintento de archivos.
- `src/features/billing/presentation.ts`: etiquetas, iconos semánticos y disponibilidad de acciones como modelo puro.
- `src/features/billing/fiscal-status-badge.tsx`: indicador accesible con icono, texto y color.
- `src/app/(dashboard)/facturacion/billing-manager.tsx`: muestra siempre las acciones y aplica sus estados habilitado/deshabilitado.
- `src/components/ui/icon-button.tsx`: impide navegación real cuando un enlace está deshabilitado.
- `scripts/repair-invoice-evidence.ts`: importación operativa segura de una respuesta original, sin imprimir contenido fiscal.
- `tests/unit/*`: contrato, transiciones, webhook, evidencia, reparación y presentación.

---

## Task 1: Normalize the real IntellyDTE response envelope

**Files:**

- Modify: `src/features/integrations/intellydte-contract.ts`
- Modify: `src/features/integrations/intellydte.ts`
- Modify: `tests/unit/intellydte-gateway.test.ts`

- [ ] **Step 1: Add a failing wrapped-response contract test**

Create a synthetic signed XML using the existing fixture helper or an inline fictional document, encode it locally, and assert that both observed envelope shapes resolve to the same provider data:

```ts
const signedXmlBase64 = Buffer.from(syntheticSignedXml, "utf8").toString("base64");
const data = {
  dteRecordId: "provider-document-101",
  folio: 101,
  siiStatus: "DOK",
  printPayload: {
    ready: true,
    signedXmlBase64,
    ted: { xml: "<TED version=\"1.0\"></TED>", pdf417Base64: "c3ludGhldGlj" },
  },
  pdf: { letterAvailable: false, thermalAvailable: false },
};

expect(providerData({ success: true, data })).toEqual(data);
expect(providerData({ body: { success: true, data }, statusCode: 202 })).toEqual(data);
```

Also exercise the gateway with the wrapped response and assert:

```ts
expect(result.kind).toBe("issued");
expect(result.providerDocumentId).toBe("provider-document-101");
expect(result.signedXmlBase64).toBe(signedXmlBase64);
```

- [ ] **Step 2: Run the focused test and verify the wrapper fails**

Run: `npm test -- tests/unit/intellydte-gateway.test.ts`

Expected: FAIL because `providerData()` currently unwraps only `root.data` and cannot reach `root.body.data`.

- [ ] **Step 3: Extend the typed provider contract and normalization**

Add the observed optional fields without treating provider PDF flags as evidence:

```ts
export type ProviderPrintPayload = {
  ready?: boolean | null;
  signedXmlBase64?: string | null;
  signedXml?: string | null;
  ted?: {
    xml?: string | null;
    pdf417Base64?: string | null;
  } | null;
};

export type ProviderPdfAvailability = {
  letterAvailable?: boolean | null;
  thermalAvailable?: boolean | null;
};
```

Normalize the envelope in one place:

```ts
function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

export function providerData(payload: unknown): Record<string, unknown> {
  const root = objectValue(payload) ?? {};
  const body = objectValue(root.body);
  const response = body ?? root;
  return objectValue(response.data) ?? response;
}
```

Keep `dataResult()` reading only `printPayload.signedXmlBase64`/`signedXml` for signed evidence. Do not map `pdf.*Available` to any stored artifact.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- tests/unit/intellydte-gateway.test.ts`

Expected: PASS for direct and wrapped response variants.

- [ ] **Step 5: Commit**

```bash
git add src/features/integrations/intellydte-contract.ts src/features/integrations/intellydte.ts tests/unit/intellydte-gateway.test.ts
git commit -m "fix: normalize IntellyDTE response envelopes"
```

---

## Task 2: Separate fiscal transitions from artifact availability

**Files:**

- Create: `src/features/billing/fiscal-state.ts`
- Create: `tests/unit/fiscal-state.test.ts`
- Modify: `src/features/billing/emission.ts`
- Modify: `tests/unit/fiscal-orchestration.test.ts`

- [ ] **Step 1: Write failing pure transition tests**

Cover the terminal-state rules explicitly:

```ts
it.each([
  ["pending", "dte.enqueued", "pending"],
  ["pending", "dte.uploaded", "processing"],
  ["pending", "dte.accepted", "issued"],
  ["processing", "dte.accepted", "issued"],
  ["processing", "dte.rejected", "rejected"],
  ["issued", "dte.enqueued", "issued"],
  ["issued", "dte.uploaded", "issued"],
] as const)("maps %s + %s to %s", (current, event, expected) => {
  expect(nextFiscalStatus(current, event)).toBe(expected);
});

it("keeps accepted fiscal status when evidence is absent", () => {
  expect(resolveIssuedOutcome({ hasXml: false, hasPdf: false })).toEqual({
    fiscalStatus: "issued",
    evidenceStatus: "pending",
    evidenceErrorCode: "SIGNED_XML_PENDING",
  });
});
```

- [ ] **Step 2: Run tests and confirm the module is absent**

Run: `npm test -- tests/unit/fiscal-state.test.ts`

Expected: FAIL because `fiscal-state.ts` does not exist.

- [ ] **Step 3: Implement the pure state policy**

Use closed unions so invalid provider strings cannot silently become local states:

```ts
export type FiscalStatus = "pending" | "processing" | "issued" | "rejected";
export type FiscalWebhookEvent = "dte.enqueued" | "dte.uploaded" | "dte.accepted" | "dte.rejected";
export type EvidenceStatus = "pending" | "complete" | "failed";

const eventStatus: Record<FiscalWebhookEvent, FiscalStatus> = {
  "dte.enqueued": "pending",
  "dte.uploaded": "processing",
  "dte.accepted": "issued",
  "dte.rejected": "rejected",
};

export function nextFiscalStatus(current: FiscalStatus, event: FiscalWebhookEvent): FiscalStatus {
  if (current === "issued" || current === "rejected") return current;
  return eventStatus[event];
}

export function resolveIssuedOutcome(input: { hasXml: boolean; hasPdf: boolean }) {
  if (input.hasXml && input.hasPdf) return { fiscalStatus: "issued" as const, evidenceStatus: "complete" as const, evidenceErrorCode: null };
  return { fiscalStatus: "issued" as const, evidenceStatus: "pending" as const, evidenceErrorCode: "SIGNED_XML_PENDING" as const };
}
```

Treat a later contradictory terminal event as idempotent and preserve the first terminal local status; record the provider event for audit, but do not oscillate accepted/rejected invoices.

- [ ] **Step 4: Change emission outcome persistence**

In `applyInvoiceResult()`, derive fiscal status independently from materialization:

```ts
const issuedOutcome = resolveIssuedOutcome({
  hasXml: Boolean(current.signedXmlEvidenceId || materialized.signedXmlEvidenceId),
  hasPdf: Boolean(current.reconstructedPdfEvidenceId || materialized.reconstructedPdfEvidenceId),
});

await tx.update(invoices).set({
  status: issuedOutcome.fiscalStatus,
  evidenceStatus: issuedOutcome.evidenceStatus,
  evidenceError: materialized.errorMessage,
  lastErrorCode: materialized.errorCode ?? issuedOutcome.evidenceErrorCode,
  siiStatus: result.siiStatus,
  siiGlosa: result.siiGlosa,
  updatedAt: now,
}).where(eq(invoices.id, invoiceId));
```

When fiscal status becomes `issued`, set the related order to `invoiced` regardless of artifact state. Remove any branch that changes an accepted result back to `pending` solely because `signedXmlEvidenceId` is null.

- [ ] **Step 5: Add an orchestration regression test**

Mock an IntellyDTE issued result with `siiStatus: "DOK"` and no signed XML. Assert:

```ts
expect(invoiceUpdate.status).toBe("issued");
expect(invoiceUpdate.evidenceStatus).toBe("pending");
expect(invoiceUpdate.lastErrorCode).toBe("SIGNED_XML_PENDING");
expect(orderUpdate.status).toBe("invoiced");
expect(gateway.issueInvoice).toHaveBeenCalledTimes(1);
```

- [ ] **Step 6: Run focused tests**

Run: `npm test -- tests/unit/fiscal-state.test.ts tests/unit/fiscal-orchestration.test.ts`

Expected: PASS, including accepted-without-files regression.

- [ ] **Step 7: Commit**

```bash
git add src/features/billing/fiscal-state.ts src/features/billing/emission.ts tests/unit/fiscal-state.test.ts tests/unit/fiscal-orchestration.test.ts
git commit -m "fix: decouple fiscal and evidence states"
```

---

## Task 3: Correlate and persist tenant-optional webhooks safely

**Files:**

- Modify: `src/features/billing/emission.ts`
- Modify: `tests/unit/fiscal-webhook-persistence.test.ts`
- Create: `tests/unit/fiscal-webhook-state.test.ts`

- [ ] **Step 1: Add failing tests for the production webhook shape**

Use a fictional provider ID and omit `tenantRut`:

```ts
const payload = {
  id: "event-accepted-101",
  type: "dte.accepted",
  data: {
    dteRecordId: "provider-document-101",
    siiStatus: "DOK",
    siiGlosa: "Documento aceptado",
  },
};
```

Assert that the invoice is found by `providerDocumentId`, the stored tenant is retained, fiscal status becomes `issued`, and the related order becomes `invoiced` even without evidence. Add cases for:

- provided tenant matches: process normally;
- provided tenant differs: acknowledge safely, persist audit outcome, do not modify invoice;
- duplicate event ID: no repeated invoice/order update;
- `dte.uploaded` after `dte.accepted`: invoice stays `issued`;
- unknown provider document: acknowledge without target and retain the event record.

- [ ] **Step 2: Run focused tests and confirm missing-tenant failure**

Run: `npm test -- tests/unit/fiscal-webhook-persistence.test.ts tests/unit/fiscal-webhook-state.test.ts`

Expected: FAIL because the current handler requires both `dteRecordId` and `tenantRut`.

- [ ] **Step 3: Change correlation to provider ID first**

Replace the mandatory pair with this policy:

```ts
if (!providerDocumentId) {
  return acknowledgeWithoutTarget(eventId, "missing_provider_document_id");
}

const [invoice] = await db.select().from(invoices)
  .where(eq(invoices.providerDocumentId, providerDocumentId))
  .limit(1)
  .execute();

if (!invoice) return acknowledgeWithoutTarget(eventId, "invoice_not_found");
if (tenantRut && normalizeRut(tenantRut) !== normalizeRut(invoice.tenantRut)) {
  return acknowledgeWithoutTarget(eventId, "tenant_mismatch");
}

const effectiveTenantRut = invoice.tenantRut;
```

Do not write `tenantRut: null` from webhook data. Use `effectiveTenantRut` for audit/orchestration calls.

- [ ] **Step 4: Apply state transitions atomically**

Within one short transaction:

1. lock or conditionally claim the unprocessed webhook event;
2. re-read the invoice by unique provider ID;
3. calculate `nextFiscalStatus()`;
4. update invoice and, for `issued`, order;
5. mark webhook processed with its outcome.

Do not call IntellyDTE or render evidence inside this transaction. If evidence must be materialized, return the invoice ID and perform it after commit.

- [ ] **Step 5: Run focused tests**

Run: `npm test -- tests/unit/fiscal-webhook-persistence.test.ts tests/unit/fiscal-webhook-state.test.ts tests/unit/fiscal-state.test.ts`

Expected: PASS for missing tenant, mismatched tenant, duplicates and terminal precedence.

- [ ] **Step 6: Commit**

```bash
git add src/features/billing/emission.ts tests/unit/fiscal-webhook-persistence.test.ts tests/unit/fiscal-webhook-state.test.ts
git commit -m "fix: correlate IntellyDTE webhooks by provider id"
```

---

## Task 4: Extract and harden local XML/PDF materialization

**Files:**

- Create: `src/features/billing/evidence-orchestration.ts`
- Modify: `src/features/billing/emission.ts`
- Create: `tests/unit/evidence-orchestration.test.ts`
- Modify: `tests/unit/fiscal-orchestration.test.ts`

- [ ] **Step 1: Write failing service tests with synthetic fiscal data**

Test these cases:

- valid `signedXmlBase64` is decoded, validated against expected issuer/type/folio, stored as private XML, rendered locally and stored as PDF;
- invalid Base64 returns `failed` and never invokes PDF rendering;
- issuer/type/folio mismatch returns `failed` and stores no artifact;
- XML stores successfully but PDF rendering fails: keep XML ID, mark evidence `failed`, preserve fiscal acceptance;
- no signed XML returns `pending` with `SIGNED_XML_PENDING`;
- provider PDF flags are ignored.

The public result should be asserted exactly:

```ts
expect(result).toEqual({
  status: "complete",
  signedXmlEvidenceId: "xml-evidence-101",
  reconstructedPdfEvidenceId: "pdf-evidence-101",
  errorCode: null,
  errorMessage: null,
});
```

- [ ] **Step 2: Run the new test and verify it fails**

Run: `npm test -- tests/unit/evidence-orchestration.test.ts`

Expected: FAIL because the module is not yet extracted.

- [ ] **Step 3: Define a reusable materialization boundary**

Implement:

```ts
export type EvidenceMaterializationResult = {
  status: "pending" | "complete" | "failed";
  signedXmlEvidenceId: string | null;
  reconstructedPdfEvidenceId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
};

export type MaterializeInvoiceEvidenceInput = {
  invoiceId: string;
  signedXmlBase64: string | null;
  expectedIssuerRut: string;
  expectedDteType: string;
  expectedFolio: string;
};

export async function materializeInvoiceEvidence(
  input: MaterializeInvoiceEvidenceInput,
): Promise<EvidenceMaterializationResult>;
```

Implementation sequence:

1. reject empty/invalid Base64 without logging the input;
2. parse with `parseSignedDteXmlBytes()`;
3. validate normalized issuer RUT, DTE type and folio;
4. persist bytes with `storeSignedXmlBytes()`;
5. generate PDF417 from `parsed.tedXml` and call `renderFiscalPdf()`;
6. persist with `storeReconstructedPdf()`;
7. return IDs and evidence status.

Catch errors into stable error codes while logging only invoice ID, stage and error code. Never log XML, Base64, TED or rendered bytes.

- [ ] **Step 4: Replace the private duplicate orchestration**

Remove `materializeEvidence` from `emission.ts` and call the new service from initial issuance and any response refresh that contains signed XML. Ensure `applyInvoiceResult()` consumes the structured result but owns fiscal persistence.

- [ ] **Step 5: Run focused tests**

Run: `npm test -- tests/unit/evidence-orchestration.test.ts tests/unit/fiscal-orchestration.test.ts tests/unit/fiscal-evidence.test.ts`

Expected: PASS with a locally generated PDF whose first bytes are `%PDF`.

- [ ] **Step 6: Commit**

```bash
git add src/features/billing/evidence-orchestration.ts src/features/billing/emission.ts tests/unit/evidence-orchestration.test.ts tests/unit/fiscal-orchestration.test.ts
git commit -m "refactor: isolate fiscal evidence materialization"
```

---

## Task 5: Add a no-reissue artifact retry path

**Files:**

- Modify: `src/features/billing/service.ts`
- Modify: `src/features/billing/actions.ts`
- Modify: `src/features/integrations/intellydte.ts`
- Create: `tests/unit/invoice-evidence-retry.test.ts`
- Create: `tests/unit/billing-actions.test.ts`

- [ ] **Step 1: Read the installed Next.js Server Action guides**

Read completely:

```text
node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-server.md
node_modules/next/dist/docs/01-app/02-guides/server-actions.md
```

Confirm that authorization and input validation remain inside the exported Server Action/service boundary.

- [ ] **Step 2: Add failing retry tests**

Cover two allowed repair paths and the forbidden reissue path:

```ts
it("rebuilds a missing PDF from stored signed XML", async () => {
  await retryInvoiceEvidence("invoice-101", "user-101");
  expect(renderFiscalPdf).toHaveBeenCalledTimes(1);
  expect(storeReconstructedPdf).toHaveBeenCalledTimes(1);
  expect(gateway.issueInvoice).not.toHaveBeenCalled();
});

it("asks status once when accepted invoice has no stored XML", async () => {
  await retryInvoiceEvidence("invoice-101", "user-101");
  expect(gateway.getInvoiceStatus).toHaveBeenCalledTimes(1);
  expect(gateway.issueInvoice).not.toHaveBeenCalled();
});
```

Also assert that a status response still lacking XML returns a safe pending result and does not change `status: "issued"`.

- [ ] **Step 3: Implement the service operation**

Add:

```ts
export async function retryInvoiceEvidence(
  invoiceId: string,
  userId: string,
  gateway: IntellyDteGateway = createIntellyDteGateway(),
): Promise<{ status: "complete" | "pending" | "failed"; message: string }>;
```

Rules:

- authorize tenant access exactly as download/email services do;
- require fiscal status `issued`;
- if signed XML exists, re-parse stored bytes and regenerate only the PDF;
- if XML does not exist, call `getInvoiceStatus()` once and materialize only if it contains signed XML;
- never call `issueInvoice()`;
- update only `evidenceStatus`, evidence IDs/errors and timestamps;
- leave `status`, folio, provider ID and order status unchanged.

- [ ] **Step 4: Wire a validated Server Action**

In `actions.ts`, add a Zod-validated action following the project action-result pattern:

```ts
const retryEvidenceSchema = z.object({ invoiceId: z.string().uuid() });

export async function retryInvoiceEvidenceAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = retryEvidenceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Factura inválida." };
  const result = await retryInvoiceEvidence(parsed.data.invoiceId, user.id);
  revalidatePath("/facturacion");
  return { ok: result.status === "complete", message: result.message };
}
```

Use the actual local `ActionResult` and authentication helper names found in the file; preserve their existing public shape.

- [ ] **Step 5: Run focused tests**

Run: `npm test -- tests/unit/invoice-evidence-retry.test.ts tests/unit/billing-actions.test.ts`

Expected: PASS and zero calls to invoice issuance in all retry cases.

- [ ] **Step 6: Commit**

```bash
git add src/features/billing/service.ts src/features/billing/actions.ts src/features/integrations/intellydte.ts tests/unit/invoice-evidence-retry.test.ts tests/unit/billing-actions.test.ts
git commit -m "feat: retry fiscal artifacts without reissuing"
```

---

## Task 6: Present Bevox-style fiscal states and always-visible actions

**Files:**

- Create: `src/features/billing/presentation.ts`
- Create: `src/features/billing/fiscal-status-badge.tsx`
- Modify: `src/app/(dashboard)/facturacion/billing-manager.tsx`
- Modify: `src/components/ui/icon-button.tsx`
- Create: `tests/unit/billing-presentation.test.tsx`
- Create: `tests/unit/icon-button.test.tsx`
- Replace: `tests/unit/billing-ui.test.ts`

- [ ] **Step 1: Write failing behavior tests**

Do not add source-text assertions. Render the badge/button with `react-dom/server` and test the pure action model.

```ts
expect(getFiscalPresentation("issued")).toMatchObject({
  label: "Aceptada",
  icon: "badge-check",
  tone: "success",
});

expect(getInvoiceActionAvailability({
  status: "issued",
  evidenceStatus: "pending",
  hasPdf: false,
  hasXml: false,
})).toEqual({
  pdf: { enabled: false, reason: "El PDF tributario aún se está generando." },
  xml: { enabled: false, reason: "El XML firmado aún no está disponible." },
  email: { enabled: false, reason: "Genera el PDF tributario antes de enviarlo." },
  refresh: { visible: false },
  retry: { visible: true, enabled: true },
});
```

Render a disabled `IconButton` with `href` and assert there is no active anchor/navigation target and that `aria-disabled="true"` is present.

- [ ] **Step 2: Run tests and verify they fail**

Run: `npm test -- tests/unit/billing-presentation.test.tsx tests/unit/icon-button.test.tsx`

Expected: FAIL because the presentation model and fiscal badge do not exist and disabled links still render as navigable links.

- [ ] **Step 3: Implement the presentation model**

Use this exact mapping:

```ts
export const fiscalPresentation = {
  pending: { label: "Pendiente", icon: "clock-3", tone: "warning" },
  processing: { label: "Procesando", icon: "loader-circle", tone: "info" },
  issued: { label: "Aceptada", icon: "badge-check", tone: "success" },
  rejected: { label: "Rechazada", icon: "circle-x", tone: "danger" },
} as const;
```

`getInvoiceActionAvailability()` must implement:

- PDF enabled iff `hasPdf`;
- XML enabled iff `hasXml`;
- email enabled iff `hasPdf`;
- refresh visible iff fiscal status is `pending` or `processing`;
- retry visible iff fiscal status is `issued` and evidence is not `complete`;
- disabled controls include a concise Spanish reason.

- [ ] **Step 4: Build the accessible fiscal badge**

Map semantic icon names to lucide components:

```tsx
const icons = {
  "clock-3": Clock3,
  "loader-circle": LoaderCircle,
  "badge-check": BadgeCheck,
  "circle-x": CircleX,
} as const;
```

Render icon plus visible text, `aria-label`, tone-specific colors, and `animate-spin` only for `processing`. Do not convey state through color alone.

- [ ] **Step 5: Make disabled link-buttons non-navigable**

In `IconButton`, when `href && disabled`, render a non-anchor element with the same visual classes and:

```tsx
<span role="link" aria-disabled="true" title={title} className={classes}>
  {children}
</span>
```

Do not leave an `href`, click handler or keyboard activation path on the disabled variant.

- [ ] **Step 6: Wire the invoice table actions**

Replace the generic status badge with `FiscalStatusBadge`. Render PDF, XML and email controls for every row, using the action model to enable or disable them. Add the retry-files control invoking `retryInvoiceEvidenceAction`; retain refresh only for nonterminal states. Expose the disabled reason with `title` and accessible text.

Delete the source-grep expectations in `tests/unit/billing-ui.test.ts` and replace them with rendered behavior tests covering all four fiscal states and accepted-with-files/accepted-without-files actions.

- [ ] **Step 7: Run focused tests**

Run: `npm test -- tests/unit/billing-presentation.test.tsx tests/unit/icon-button.test.tsx tests/unit/billing-ui.test.ts`

Expected: PASS for labels, icons, disabled semantics and action availability.

- [ ] **Step 8: Commit**

```bash
git add src/features/billing/presentation.ts src/features/billing/fiscal-status-badge.tsx "src/app/(dashboard)/facturacion/billing-manager.tsx" src/components/ui/icon-button.tsx tests/unit/billing-presentation.test.tsx tests/unit/icon-button.test.tsx tests/unit/billing-ui.test.ts
git commit -m "feat: show fiscal status icons and artifact actions"
```

---

## Task 7: Add a secure, reusable repair command for existing accepted invoices

**Files:**

- Create: `src/features/billing/evidence-repair.ts`
- Create: `scripts/repair-invoice-evidence.ts`
- Create: `tests/unit/fiscal-evidence-repair.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write failing repair safety tests**

Use only a synthetic response file in a temporary test directory. Cover:

- invoice provider ID matches payload: materialize evidence and preserve `issued`;
- invoice provider ID differs: abort before writing any artifact;
- invoice folio/type/issuer differs from signed XML: abort;
- invoice is not already accepted: abort;
- command output contains IDs/status only and never XML, TED or Base64;
- repair never invokes `issueInvoice()` and never sends email.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `npm test -- tests/unit/fiscal-evidence-repair.test.ts`

Expected: FAIL because the repair service and command do not exist.

- [ ] **Step 3: Implement the repair service**

Define:

```ts
export type RepairInvoiceEvidenceInput = {
  invoiceId: string;
  expectedProviderDocumentId: string;
  providerResponse: unknown;
};

export async function repairInvoiceEvidence(
  input: RepairInvoiceEvidenceInput,
): Promise<{ invoiceId: string; evidenceStatus: "complete" | "failed" }>;
```

The service must:

1. load the invoice and tenant from DB;
2. require local `status === "issued"` or verified `siiStatus === "DOK"`;
3. normalize `providerResponse` through `providerData()`;
4. compare provider document ID against both the CLI confirmation and stored invoice value;
5. pass signed XML to `materializeInvoiceEvidence()` with stored issuer/type/folio expectations;
6. update only evidence columns and, if SII acceptance was already verified, normalize fiscal status/order to `issued`/`invoiced`;
7. return metadata only.

- [ ] **Step 4: Implement the CLI without secret-bearing output**

Accept explicit arguments:

```text
npm run repair:invoice-evidence -- --invoice-id 00000000-0000-4000-8000-000000000101 --provider-id provider-document-101 --input C:\secure\synthetic-intellydte-response.json
```

The script must validate that the input path is an existing regular file, parse JSON, call the repair service, and print only:

```json
{"invoiceId":"00000000-0000-4000-8000-000000000101","evidenceStatus":"complete"}
```

It must never print the parsed provider response or caught error objects that may contain request/response bodies. Map failures to stable safe codes such as `REPAIR_PROVIDER_ID_MISMATCH`.

Add to `package.json`:

```json
"repair:invoice-evidence": "tsx scripts/repair-invoice-evidence.ts"
```

- [ ] **Step 5: Run focused tests**

Run: `npm test -- tests/unit/fiscal-evidence-repair.test.ts tests/unit/evidence-orchestration.test.ts`

Expected: PASS, with assertions that captured stdout/stderr contain no synthetic XML/Base64 marker.

- [ ] **Step 6: Commit**

```bash
git add src/features/billing/evidence-repair.ts scripts/repair-invoice-evidence.ts tests/unit/fiscal-evidence-repair.test.ts package.json
git commit -m "feat: add secure invoice evidence repair command"
```

---

## Task 8: Full verification, review, push, deploy and controlled repair

**Files:**

- Verify: all modified files
- Operational input: user-provided response file outside the repository

- [ ] **Step 1: Run the full local quality gate**

Run each command independently:

```bash
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
git status --short
```

Expected:

- full Vitest suite passes;
- TypeScript reports no errors;
- oxlint reports no warnings/errors;
- production build completes;
- no whitespace errors;
- `.worktrees/` remains untracked and no fiscal payload file is staged.

- [ ] **Step 2: Perform a focused security and requirements review**

Search the diff for secret-bearing or forbidden content:

```bash
git diff --cached --name-only
git diff --check
rg -n "signedXmlBase64|pdf417Base64|<TED|<DTE" docs src scripts tests
```

Review every match: contract/property names and synthetic fixtures are allowed; real payload values are not. Confirm:

- webhook without tenant reaches the invoice;
- accepted status is terminal and independent of evidence;
- no retry path calls `issueInvoice()`;
- no provider PDF is consumed;
- all three actions remain visible with safe disabled semantics;
- logs and CLI output exclude fiscal content.

- [ ] **Step 3: Request code review and address findings**

Use `superpowers:requesting-code-review` over the complete branch diff. Any accepted change repeats its focused test plus the full affected quality gate before the review commit.

- [ ] **Step 4: Create the final verification commit if needed**

If review causes tracked changes, inspect `git status --short`, stage each reviewed file by its explicit path (never `git add .`) and run `git commit -m "fix: address fiscal workflow review"`.

If there are no changes, do not create an empty commit.

- [ ] **Step 5: Obtain explicit authorization, then push**

After reporting exact test/build results and commit list, request authorization to push the branch. Once authorized:

```bash
git push -u origin codex/fiscal-webhook-artifacts
```

Confirm the CI workflow runs its existing MySQL migration/bootstrap, tests, typecheck, lint and build stages. This feature itself should produce no new migration.

- [ ] **Step 6: Obtain explicit authorization, then deploy**

Deploy only after CI is green. Verify the deployed commit SHA and application health. Do not execute manual migrations beyond the existing deploy workflow unless production reports a specific unapplied migration.

- [ ] **Step 7: Obtain explicit authorization, then repair the current invoice**

Use the user-provided response file directly from its attachment path; never copy it into the repository. Execute the repair command on the production host against the exact invoice UUID and full stored provider document ID after read-only confirmation of:

- invoice folio is 22;
- SII status is `DOK`/accepted;
- stored provider ID matches the response;
- tenant issuer RUT matches signed XML.

After repair, verify read-only that:

- invoice status is `issued` and UI label is “Aceptada”;
- evidence status is `complete`;
- both evidence records exist and hashes validate;
- downloaded XML parses and local PDF begins `%PDF`;
- order is `invoiced`;
- no duplicate invoice, folio or provider record was created.

Do not send the repaired invoice by email until the user separately authorizes a real email delivery.

- [ ] **Step 8: Final production smoke test**

With a non-destructive existing accepted invoice, verify UI status icon, PDF download, XML download, disabled/enabled action reasons and webhook audit outcome. For the next legitimately issued test invoice, verify that `dte.accepted` transitions automatically without manual refresh and that local artifacts complete asynchronously.

---

## Plan Self-Review

- [ ] Every approved specification requirement maps to at least one task and one verification assertion.
- [ ] No task requires the provider to supply a final PDF.
- [ ] No artifact error can overwrite a terminal fiscal state or trigger reissuance.
- [ ] All examples use fictional IDs and synthetic fiscal content.
- [ ] No unfinished implementation marker or real payload appears in this plan.
- [ ] Added public interfaces use closed TypeScript unions consistent with the existing Drizzle values.
- [ ] Production mutation, email delivery and push/deploy remain explicit approval gates.
