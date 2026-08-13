# Quickstart Validation Guide

## Prerequisites

- Node.js 24 and pnpm 11
- Docker Desktop or another MySQL 8 instance for local integration tests
- No live Hostinger or IntellyDTE credentials are required for the default fake-provider workflow

## Local setup

1. Copy `.env.example` to `.env.local` and keep `INTELLYDTE_MODE=fake`.
2. Start local MySQL: `docker compose up -d mysql`.
3. Install dependencies: `pnpm install`.
4. Apply migrations: `pnpm db:migrate`.
5. Create the first administrator using the documented seed command and a password supplied through
   an interactive prompt or environment variable that is not committed.
6. Start the application: `pnpm dev` and open `http://localhost:3000`.

## Automated gates

Run, in order:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
```

Expected result: every command exits successfully; the test output contains no live provider calls or
printed secrets.

## End-to-end acceptance path

1. An unauthenticated visit to `/dashboard` redirects to `/login`.
2. Invalid credentials return one generic error and repeated attempts trigger a temporary throttle.
3. Sign in as the seeded administrator and verify the responsive sidebar lists all six modules.
4. Create one client and one taxable service.
5. Create an order, add the service, verify the displayed CLP totals, and emit it.
6. Open the generated public link in a private session; only minimal order data is visible.
7. Record a full manual payment twice with the same idempotency key; only one payment exists.
8. Issue the invoice using the fake IntellyDTE adapter; repeat the request and verify the same invoice
   and folio are returned.
9. Confirm dashboard metrics reflect the paid and invoiced order for the selected period.
10. Inspect Integrations: fake IntellyDTE is healthy, MySQL is healthy, and no secret is displayed.

## Hostinger verification (requires credentials)

1. Create a least-privileged MySQL user and database in hPanel.
2. If the app runs outside Hostinger, allowlist only its fixed outbound IP in Remote MySQL; do not use
   “Any Host”. Confirm whether the selected plan supplies and requires a CA certificate.
3. Set production database environment variables, run the migration command from the deployment
   environment, restart the Node application, and execute the read-only health check.
4. Do not point automated tests at production. Back up the database before the first schema change.

## IntellyDTE verification (requires authoritative contract)

1. Obtain sandbox base URL, authentication method, company identifiers, issue/status endpoints,
   payload schema, idempotency behavior, timeout guidance, and sample accepted/rejected responses.
2. Implement the HTTP mapping behind the adapter in
   [intellydte-adapter.md](./contracts/intellydte-adapter.md) and add contract fixtures.
3. Execute sandbox issue, duplicate retry, rejection, timeout, and reconciliation scenarios.
4. Enable HTTP mode in production only after sandbox evidence and secret-redaction review pass.
