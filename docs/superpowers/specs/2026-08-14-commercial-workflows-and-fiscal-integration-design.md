# Commercial Workflows and Fiscal Integration

## Status

Design approved in conversation on 2026-08-14. This document is the source design for the implementation plan; it does not authorize changes to the code until the implementation plan is reviewed.

## Context

`intelly-gestor` is a Next.js application with server actions, Drizzle/MySQL persistence, a shared Tailwind-based UI, and modules for catalog items, clients, payment orders, billing, integrations, users, and authentication.

The current code already provides:

- Active/inactive catalog and client records.
- Payment-order lines with quantity, unit price, tax rate, subtotal, tax amount, and total.
- Order state transitions from draft to issued, paid, and invoiced.
- A fake IntellyDTE gateway and a deliberately closed HTTP gateway.
- Commercial order PDFs generated locally.
- An encrypted IntellyDTE API-key configuration.
- Basic integration attempts with safe messages and correlation IDs.

The requested work spans shared UI behavior, query architecture, database contracts, a POS-like order workflow, real IntellyDTE communication, signed-XML fiscal evidence, and integration observability. It is therefore planned as a phased architectural change rather than as isolated screen adjustments.

Local reference repositories are available under `C:\laragon\www`:

- `intellydte`: the authoritative local IntellyDTE implementation. Its invoice endpoint is `POST /api/v1/dte/factura`; it accepts `x-api-key`, `Idempotency-Key`, and emission-mode headers, and returns a `printPayload` containing signed XML and TED/PDF417 data.
- `bevox`: a reference consumer with real IntellyDTE payload mapping, idempotency, webhook verification, trace persistence, and XML-to-PDF reconstruction.

The two local copies of `intelly-gestor` at `C:\Users\Chipilin\Documents\intelly-gestor` and `C:\laragon\www\intelly-gestor` are the same Git commit (`6a00b5f`). The Laragon copy is the clean working reference; the Documents copy only contains generated, untracked `output/` and `tmp/` artifacts.

## Goals

1. Establish a consistent icon-only action language with accessible tooltips across the application.
2. Remove redundant cards around tables and provide reusable, server-side search, filtering, tabs, and pagination.
3. Improve catalog and client data quality without breaking historical records.
4. Add a reliable client RUT lookup through IntellyDTE.
5. Replace the order modal with a multi-line POS workflow that calculates CLP totals and discounts on the server.
6. Support safe editing, PDF delivery, and email delivery for payment orders.
7. Integrate real DTE 33 emission through the local IntellyDTE contract.
8. Reconstruct the fiscal PDF exclusively in `intelly-gestor` from the signed XML returned by IntellyDTE.
9. Provide Spanish, detailed, sanitized integration traces and JSON inspection.
10. Preserve auditability, idempotency, security, and deployability at every phase.

## Non-goals

- The gestor will not ask IntellyDTE to render or download a PDF. IntellyDTE is the source of the signed XML and DTE metadata only.
- The commercial payment-order PDF and the fiscal DTE PDF will not share a renderer or data contract.
- A client RUT lookup will not automatically create or save a client.
- Editing an already invoiced or paid order will not be used as a fiscal correction mechanism.
- The project will not enable live HTTP emission until provider credentials, sandbox behavior, issuer setup, folios, and webhook delivery have been verified.

## Design Principles

- Server-side validation and recalculation are authoritative.
- URL query parameters are the source of truth for list state.
- Historical snapshots are immutable once captured in an order line or fiscal evidence record.
- Provider retries must be idempotent and must not create duplicate folios.
- XML signed by the provider is the fiscal source of truth.
- Logs are detailed but sanitized; credentials and bearer material never enter persisted traces.
- New shared components must solve an existing repeated problem without creating a generic abstraction that has no consumer.
- Existing historical data is migrated conservatively instead of being deleted or silently rewritten.

## Architecture

### Shared UI foundation

Add or extend the shared UI layer with:

- `IconButton` for icon-only buttons and links. It requires an accessible label, a visible tooltip on hover/focus, a disabled/pending state, and a semantic variant.
- `TableToolbar` for search, filters, and status tabs.
- `Pagination` for page, page size, total count, and navigation.
- `ComboBox` for searchable, keyboard-accessible selections.
- `MoneyInput` for formatted CLP display with a normalized integer form value.
- A table surface contract in `TableShell`; table pages must not wrap the table in an additional `Card`.

Every icon-only action will have both `aria-label` and a focusable tooltip. Hover will not be the only way to discover the action. The same rule applies to table actions, page-header actions, import/export/template controls, logout, modal triggers, and form submit actions. Text remains available in headings, status labels, confirmations, and accessible names.

Table list state will use a common validated query contract:

```text
page, pageSize, q, status, tab, and module-specific filters
```

Changing search or a filter resets the page to one. Query values are bounded and parsed with Zod. Server pages query only the requested page and return the total count needed for pagination. List services will no longer rely on fixed `limit(100)` or `limit(500)` values for interactive screens.

### Table behavior

The following modules will use the shared table foundation:

- Productos y Servicios.
- Clientes.
- Órdenes de Pago.
- Facturación.
- Integraciones.
- Usuarios.

The default mobile card rendering can remain where it improves readability, but it must be a table presentation mode, not an extra outer card. Empty states and form panels may continue to use cards because they represent separate content blocks.

## Phase 1: Shared UI and Query Foundation

### Behavior

- Remove the extra `Card` surrounding every table list.
- Add icon-only actions and tooltips to all affected pages.
- Make logout a `LogOut` icon with a tooltip, accessible label, pending state, and confirmation behavior unchanged.
- Add server-side pagination, search, filters, and URL-preserved state to every table.
- Add Spanish labels for all filter and pagination controls.
- Preserve the current visual brand language and responsive behavior.

### Data and service contract

Each list service will expose a typed query input and a result with:

```ts
{
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
```

Services must use parameterized Drizzle conditions, deterministic ordering, and count queries. Search fields and indexes will be selected per module rather than applying unindexed wildcard searches to every column.

### Validation

- Component tests for accessible names, tooltip focus behavior, and pending states.
- Query tests for invalid page values, filter combinations, reset-to-page-one behavior, and stable ordering.
- Render tests proving table pages no longer add the redundant table card.

## Phase 2: Catalog and Clients

### Catalog

The catalog type enum becomes `product | service | project`. The change propagates to the database schema, validators, CSV parser/serializer, export/template labels, UI badges, and order selectors.

The default tab is `Activos`; additional tabs are `Inactivos` and `Todos`. The type filter supports Producto, Servicio, and Proyecto. Search covers code and name, and status remains independently filterable.

The new-concept form uses:

- A searchable `ComboBox` for type.
- A CLP `MoneyInput` that displays Chilean formatting but submits a normalized positive integer.
- An automatically generated code derived from the name: uppercase ASCII, accents removed, non-alphanumeric characters removed, maximum 10 characters, and deterministic collision resolution. The server generates and validates it; the create form displays it as read-only.
- Existing codes are preserved on edits to avoid changing historical line snapshots. Legacy codes longer than 10 characters are not rewritten automatically.

The generator must be deterministic and collision-safe under concurrent creates. A unique database constraint remains the final authority.

### Clients

The default client tab is `Activos`; additional tabs are `Inactivos` and `Todos`. Search covers RUT, legal name/name, and email. Filters cover client kind and status.

The client form includes:

- Searchable `ComboBox` for Empresa/Persona.
- Required RUT, razón social/nombre, and address, enforced in browser and server validation.
- Existing email validation remains required because order email delivery depends on it.
- New `giro` field.
- Region, commune, and city selections from a local Chilean geography catalog.
- A dependent selection flow of Región → Comuna → Ciudad. City is populated from the selected region/commune mapping and is not free text.

Existing schema support for `clients.region` will be used. `giro` will be added through a migration and propagated through actions, CSV import/export, list projections, and fiscal payload mapping. Existing incomplete records remain available for correction; new writes cannot omit newly required fields.

### RUT lookup

The client form adds a lookup icon beside the RUT field. After a valid RUT is entered, the server-side integration layer calls:

```text
GET /api/v1/rut/{rut}
```

The endpoint requires the IntellyDTE API key and returns `rut`, `razonSocial`, and `autorizado`. The browser never receives the API key. The result populates the legal-name field and shows the authorization status as contextual information. The name remains editable, and the form is not saved until the user confirms it.

The UI handles loading, invalid RUT, unavailable upstream service, missing reason social, and successful lookup in Spanish. Manual entry remains available when IntellyDTE is unavailable. Lookup calls are bounded by timeout and cache policy and must not create an audit event or client record by themselves.

### Validation

- Catalog tests for project type, code generation, collision behavior, and CLP normalization.
- Client tests for required fields, geography mapping, RUT validation, CSV compatibility, and lookup response mapping.
- Integration tests with a fake IntellyDTE lookup response and upstream failure cases.
- E2E coverage for active tabs, filters, form validation, and RUT autocompletion.

## Phase 3: Payment Order POS

### Fallback correction

The order page will no longer decide `canCreate` from stale, fixed-size arrays. It will query whether active clients and catalog items exist, use server revalidation after client/catalog changes, and provide a regression test for the sequence “create active client and concept, return to orders, create order”.

### Pages and flow

- `/ordenes` remains the paginated list.
- `/ordenes/nueva` becomes the POS-style creation page.
- `/ordenes/[id]/editar` becomes the edit page.

The creation page contains:

1. Client search by RUT or name.
2. Quick client creation using the client form and RUT lookup, returning the new client to the POS.
3. Catalog search across active products, services, and projects.
4. A cart with one or more lines.
5. Inline quantity and unit-price editing.
6. A global discount percentage and discount concept/glosa.
7. A summary with net subtotal, discount, taxable/exempt split, IVA, and total.
8. A server action to persist the complete draft transactionally.

Client and catalog searches are server-backed and bounded; the POS may use controlled client-side state for the current cart. The browser never supplies trusted totals.

### Calculation contract

The server recalculates every line and the order using integer CLP minor units. The global discount is allocated proportionally across lines, then taxable/exempt tax bases are calculated from the discounted values. Rounding rules are explicit and tested, including the final-line remainder adjustment so the sum of lines equals the order totals.

The persisted order stores discount amount and the discount concept. Lines snapshot code, description, quantity, unit price, tax rate, subtotal, tax amount, and total.

### Editing and states

- Draft orders can be edited completely.
- Issued but unpaid orders can be edited completely. The order version increments, an audit event is written, and the public token is rotated so an old link cannot expose stale totals.
- Paid, invoiced, cancelled, and expired orders cannot change fiscal or financial fields. Only explicitly permitted operational fields, such as notes, may be editable.
- An invoiced order is never corrected by mutating the order through the POS.

Optimistic version checks prevent lost updates. Public access continues to require an unexpired, non-revoked token.

### Email delivery

An icon-only “Enviar por correo” action confirms the destination before sending. The message contains the secure public order link and the commercial order PDF. The destination, order ID, and result are audited; credentials and raw message secrets are not persisted. Missing SMTP or invalid customer email produces a Spanish error without changing the order state.

### Validation

- Domain tests for discount allocation, tax calculation, rounding, and valid/invalid state edits.
- Transaction tests for multi-line persistence and optimistic version conflicts.
- Email tests for SMTP configuration, destination, attachment/link generation, and failure behavior.
- E2E tests for POS search, quick client creation, multi-line cart, inline price changes, discount summary, save, edit, issue, and send.

## Phase 4: Fiscal Billing and Signed-XML PDF

### IntellyDTE emission

The HTTP gateway will implement the local IntellyDTE contract rather than the previous placeholder behavior:

- `POST /api/v1/dte/factura`.
- `x-api-key` authentication.
- Stable `Idempotency-Key` for the order/provider operation.
- `x-intelly-emission-mode` for sync or async behavior.
- Provider base URL normalized to the service root, with `/api/v1` route handling explicit in the adapter.

The payload is built from the order and client snapshots and includes receptor data, `giro`, address, commune, city, lines, discount information, net/exempt/IVA/total amounts, and document-specific fields. A fiscal preflight validates issuer configuration, receiver RUT, required receptor fields, line values, and total consistency before the outbound call.

The local invoice state transitions are:

```text
pending -> processing -> issued
pending -> processing -> rejected
pending -> processing -> pending (provider response uncertain)
```

A timeout or uncertain 5xx result never triggers a second create call automatically. The application queries the provider status using the known DTE record ID or folio before retrying.

### Webhooks

The gestor exposes a protected inbound endpoint for IntellyDTE webhook events. It verifies `X-Intelly-Signature` as `sha256=<HMAC-SHA256>` over the raw request body. The webhook secret is encrypted/configured separately from the API key.

Events are deduplicated by provider `eventId` and correlated using `dteRecordId`, folio, type, and issuer context. The handler supports:

- `dte.enqueued`.
- `dte.uploaded`.
- `dte.accepted`.
- `dte.review_required`.
- `dte.rejected`.

Processing updates invoice status, SII status, glosa, track ID, folio, order status, and evidence references in a transaction. Unknown events receive a safe acknowledgement and are recorded for inspection.

### Evidence storage

The invoice stores provider identifiers and hashes. A separate evidence/artifact model or equivalent storage contract records:

- Signed XML bytes and SHA-256 hash.
- Reconstructed PDF bytes and SHA-256 hash.
- MIME type, storage key, DTE type, folio, and renderer version.
- Creation and regeneration timestamps.

Evidence storage is private and access is mediated by authenticated routes. Raw signed XML is not placed in a public URL.

### PDF reconstruction in the gestor

The gestor always reconstructs the fiscal representation locally. It does not call an IntellyDTE PDF endpoint and does not treat a provider PDF as an input.

The renderer pipeline is:

1. Decode `data.printPayload.signedXmlBase64`.
2. Parse the XML with namespace-safe selectors and reject malformed or incomplete XML.
3. Extract `IdDoc`, `Emisor`, `Receptor`, `Totales`, `Detalle`, `Referencia`, and the original `TED`.
4. Preserve the original TED XML and encode it for PDF417 using the same Latin-1-safe behavior as the local IntellyDTE implementation.
5. Render a fiscal layout with `jsPDF`/`jspdf-autotable` and a PDF417 generator. The existing commercial order renderer remains a separate module.
6. Include issuer/receptor data, document type and folio, emission/due dates, detail lines, discounts, taxes, totals, references, resolution data when present, and PDF417/TED.
7. Persist the PDF with a renderer version and return it through an authenticated download route.

The renderer is a representation reconstructed from the signed XML. The XML is the source of truth, and regeneration must produce the same fiscal values even when visual layout code changes. Tests compare extracted XML values with rendered document inputs and verify the TED/PDF417 data is derived from the original TED.

### Billing UI

Facturación will show active document filters, pagination, and a download icon for issued documents. Emission, status refresh, and download actions use icon-only controls with tooltips and Spanish status explanations.

## Phase 5: Integration Logs and JSON Inspection

### Persistence

Integration attempts/traces store:

- Direction, operation, event type, endpoint, correlation ID, and idempotency key hash/mask.
- HTTP status, provider code, normalized status, duration, and timestamps.
- Full request and response JSON after sanitization.
- Allowed diagnostic headers and related webhook event IDs.
- A Spanish safe message plus the original provider message/code.

API keys, authorization headers, cookies, passwords, secrets, private keys, session tokens, webhook secrets, and similar values are redacted recursively. Signed XML and fiscal PDFs are referenced as evidence artifacts rather than copied into transient traces.

### UI

The integration list is searchable, filterable, paginated, and translated. Filters include result status, direction, operation, event type, date range, correlation ID, folio, and DTE record ID. Clicking an attempt opens a detail view with:

- Human Spanish label and original provider value.
- Request and response JSON pretty-printed, expandable, and copyable.
- Sanitized headers, timing, HTTP status, error chain, and webhook timeline.
- Links to authenticated invoice evidence where the user has permission.

Operational traces have a bounded retention period. Fiscal XML/PDF evidence follows the application retention policy independently.

### Validation

- Redaction tests for nested JSON and headers.
- Correlation tests from emission through webhook to invoice.
- Persistence tests for rejected, pending, accepted, and unknown events.
- UI tests for translated states, JSON detail, filters, pagination, and permission handling.

## Data Migration Summary

Migrations will be generated and applied in dependency order:

1. Add catalog project enum support and any supporting indexes.
2. Add client `giro` and preserve existing `region` data.
3. Add order discount percentage/glosa and order email-delivery audit data.
4. Add invoice provider/SII fields and evidence artifact storage references.
5. Add integration trace payload, timing, webhook event, and deduplication fields.
6. Add search/list indexes after data shape changes are validated.

Existing rows are not deleted. Backfills are explicit, auditable, and safe to rerun. New required-field validation does not make the migration fail merely because a historical row is incomplete.

## Security and Reliability

- All new server actions and webhook routes enforce origin/authentication checks appropriate to their direction.
- Provider credentials are server-only and encrypted at rest.
- Webhook signatures use constant-time comparison over the exact raw body.
- All outbound provider calls have bounded timeouts and no unsafe automatic duplicate retry.
- Public order tokens are hashed, revocable, expiring, and rotated when an issued order is financially edited.
- Evidence downloads require an authenticated session and authorization.
- Log payloads are recursively sanitized before persistence and display.
- Audit events cover client/catalog changes, order edits, order email sends, invoice emissions, webhook updates, evidence generation, and trace access where required.

## Rollout and Verification

### Phase gates

Each phase must pass `npm run lint`, `npm run typecheck`, `npm test`, and the phase-specific tests before the next phase starts. Database-dependent integration tests use an isolated MySQL instance; browser tests never point at production.

### Fiscal activation gate

HTTP mode stays disabled until all of the following are confirmed against the local/provider sandbox:

- IntellyDTE base URL and API key.
- Issuer RUT and fiscal profile.
- DTE 33 payload acceptance and rejection fixtures.
- Idempotent replay behavior.
- Sync, async, timeout, and status-query behavior.
- Webhook secret, delivery URL, signature, and event fixtures.
- Signed XML, TED, PDF417, and local reconstruction acceptance.
- Folio and SII state reconciliation.

Until this gate passes, fake mode remains the executable default and HTTP mode fails closed.

### Definition of done

- All requested screens use the shared icon, tooltip, table, search, filter, tab, and pagination conventions.
- Catalog and client changes preserve historical records and validate new data at every boundary.
- RUT lookup works through the server-side IntellyDTE adapter with graceful degradation.
- POS creation/editing calculates and persists correct CLP totals, discounts, and IVA.
- Issued-order email delivery and public links are auditable and secure.
- Fiscal emission is idempotent, webhook-aware, and observable.
- Every downloadable fiscal PDF is reconstructed in the gestor from the signed XML and includes the original TED/PDF417.
- Integration details expose translated, sanitized, full JSON diagnostics.
- Migrations, tests, rollout instructions, and operational documentation are complete.
