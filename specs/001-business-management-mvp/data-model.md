# Phase 1 Data Model: Intelly Gestor MVP

All identifiers are opaque UUID/ULID-style strings. Timestamps are UTC. Money uses `decimal(18,2)`
with an ISO currency code; application calculations use integer minor units and validate conversion
at persistence boundaries.

## Identity and access

### users

- `id`, `email` (normalized, unique), `name`, `password_hash`
- `role`: `admin | operator`
- `status`: `active | disabled | locked`
- `failed_login_count`, `locked_until`, `password_changed_at`
- `created_at`, `updated_at`, `last_login_at`

Rules: no public creation; disabled users cannot create sessions; email changes are audited; password
hash never leaves server-only code.

### sessions

- `id`, `user_id`, `token_hash` (unique; raw token never stored)
- `ip_hash`, `user_agent`, `last_seen_at`, `idle_expires_at`, `absolute_expires_at`
- `revoked_at`, `created_at`

Rules: session is valid only while user is active, both expirations are future, and `revoked_at` is
null. Refreshing activity never exceeds absolute expiry.

### login_attempts

- `id`, `email_hash`, `ip_hash`, `succeeded`, `occurred_at`

Rules: bounded retention; indexed by email/time and IP/time for throttling; no plaintext password or
unnecessary personal data.

## Commercial catalog

### clients

- `id`, `kind`: `person | company`, `tax_id`, `legal_name`, `trade_name`
- `email`, `phone`, `address_line`, `commune`, `city`, `region`, `country_code`
- `status`: `active | inactive`, `created_at`, `updated_at`

Rules: legal name and contact path required; Chilean tax ID is normalized and validated when present;
historically referenced clients are deactivated, not hard-deleted.

### catalog_items

- `id`, `type`: `product | service`, `code` (unique), `name`, `description`
- `unit_price`, `currency`, `tax_category`: `taxable | exempt`, `tax_rate`
- `status`: `active | inactive`, `created_at`, `updated_at`

Rules: positive price, supported currency, and tax rate between 0 and 100; exempt items use zero tax;
historically referenced items are deactivated.

## Payment orders

### payment_orders

- `id`, `number` (unique human reference), `client_id`, `status`
- `currency`, `subtotal`, `discount_total`, `tax_total`, `total`
- `due_at`, `notes`, `issued_at`, `paid_at`, `cancelled_at`, `invoiced_at`
- `public_token_hash` (unique, nullable), `public_expires_at`, `public_revoked_at`
- `version` (optimistic concurrency), `created_by`, `updated_by`, timestamps

State transitions:

```text
draft -> issued -> paid -> invoiced
             |       |
             v       v
           expired  cancelled (only before fiscal emission)
draft ----------------> cancelled
```

Rules: only drafts allow commercial line edits; emission freezes lines and totals; payment requires
an issued, non-cancelled order; invoicing requires paid status; invalid transitions fail atomically.

### payment_order_lines

- `id`, `payment_order_id`, optional `catalog_item_id`
- snapshot fields: `code`, `description`, `quantity`, `unit_price`, `discount_amount`, `tax_rate`
- `subtotal`, `tax_amount`, `total`, `sort_order`

Rules: positive quantity, nonnegative monetary components, deterministic totals. Snapshot remains
unchanged if the catalog item later changes.

### payments

- `id`, `payment_order_id`, `idempotency_key` (unique), `amount`, `currency`
- `method`: `manual | external`, `external_reference`, `paid_at`, `recorded_by`, `created_at`

Rules: one business event per idempotency key; MVP requires full order amount and matching currency;
transaction updates order state once.

## Billing and integrations

### invoices

- `id`, `payment_order_id` (unique), `status`: `pending | processing | issued | rejected`
- `document_type`, `provider`, `provider_document_id`, `folio`, `request_hash`
- `issued_at`, `rejected_at`, `last_error_code`, `last_error_message`, timestamps

Rules: exactly one invoice aggregate per order; issued documents are immutable; retries reuse the
invoice and business idempotency key.

### integration_attempts

- `id`, `integration`, `operation`, `aggregate_type`, `aggregate_id`
- `idempotency_key`, `correlation_id`, `attempt_number`, `status`
- `request_hash`, `http_status`, `provider_code`, `safe_message`, timestamps

Rules: unique `(integration, idempotency_key, attempt_number)`; request/response bodies are omitted or
redacted; unknown outcomes are reconciled before a new provider create call.

### audit_events

- `id`, `actor_user_id` nullable, `actor_type`: `user | system | public`
- `action`, `entity_type`, `entity_id`, `correlation_id`, `metadata_json`, `created_at`

Rules: append-only; metadata has an allowlist and redacts secrets and sensitive full payloads.

## Indexes and relationships

- Unique: user email, catalog code, order number, public token hash, payment idempotency key, invoice
  order ID, active provider document ID when present.
- Search: client normalized tax ID/name/email; catalog name/code; order number/status/client/dates;
  invoice status/folio/dates; audit entity/date and correlation ID.
- Foreign keys restrict deletion of historical financial data. User/client/catalog deactivation is the
  normal lifecycle operation.
- Dashboard queries aggregate indexed order and invoice date/status columns; no stored derived KPI is
  required for the initial scale.
