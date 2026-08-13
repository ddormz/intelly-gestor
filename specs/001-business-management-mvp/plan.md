# Implementation Plan: Intelly Gestor MVP

**Branch**: `not-created` | **Date**: 2026-08-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-business-management-mvp/spec.md`

## Summary

Build the initial Intelly Gestor as a single deployable web application with protected internal
modules for catalog, customers, payment orders, invoicing, integrations, and analytics. The server
owns authorization, calculations, state transitions, database access, audit logging, and the
IntellyDTE boundary. MySQL stores exact monetary values and idempotency records. The browser receives
only view data and opaque, revocable session cookies.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 24.x

**Primary Dependencies**: Next.js 16 App Router, React 19, Drizzle ORM, mysql2, Zod,
`@node-rs/argon2`, Lucide React, Recharts

**Storage**: MySQL 8-compatible database on Hostinger; local MySQL through Docker Compose

**Testing**: Vitest for domain/unit tests, Testing Library for components, Playwright for critical
browser workflows, and migration/integration tests against disposable MySQL

**Target Platform**: Node.js server on Hostinger or another TLS-terminating Node host; evergreen web
browsers down to 375 px viewport

**Project Type**: Server-rendered web application with internal UI and route-handler contracts

**Performance Goals**: Useful content within 2 seconds for 95% of internal views at 25 concurrent
users; indexed list queries under 300 ms at 100k orders in the reference dataset

**Constraints**: No provider secrets in client bundles; exact decimal money; idempotent financial
mutations; pool connections to respect Hostinger connection limits; WCAG 2.2 AA; no dependency on
live IntellyDTE during development or CI

**Scale/Scope**: One organization, 25 concurrent internal users, up to 100k orders, six primary
modules, CLP-first, administrator and operator roles

## Constitution Check

*GATE: Passed before research and re-checked after design.*

- **Security and Privacy by Default**: PASS. Argon2id, opaque hashed sessions, secure cookies,
  origin validation, per-account/IP throttling, server authorization, secret redaction, and audit
  events are part of the architecture and acceptance tests.
- **Financial Data Integrity**: PASS. Decimal columns, immutable issued line snapshots, explicit
  order/invoice state machines, transactions, unique idempotency keys, and audit records are modeled.
- **Explicit Integration Boundaries**: PASS. MySQL is centralized behind the data layer and
  IntellyDTE behind a typed adapter with fake and HTTP implementations, timeouts, normalized errors,
  and correlation IDs.
- **Testable Delivery**: PASS. Unit, integration, contract, component, and browser tests cover the
  risk-ranked workflow; build, lint, and type checks are quality gates.
- **Accessible, Responsive UX**: PASS. Semantic navigation, skip link, keyboard workflows, visible
  focus, announced errors, reduced motion, responsive sidebar, textual chart fallbacks, and explicit
  states are specified.
- **Post-design re-check**: PASS. No constitutional exception or complexity waiver is required.

## Project Structure

### Documentation (this feature)

```text
specs/001-business-management-mvp/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── openapi.yaml
│   └── intellydte-adapter.md
├── checklists/requirements.md
├── spec.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── (auth)/login/
│   ├── (dashboard)/
│   │   ├── clientes/
│   │   ├── facturacion/
│   │   ├── integraciones/
│   │   ├── ordenes/
│   │   └── productos-servicios/
│   ├── api/
│   └── orden/[publicToken]/
├── components/
│   ├── dashboard/
│   ├── forms/
│   ├── layout/
│   └── ui/
├── db/
│   ├── migrations/
│   ├── schema/
│   └── index.ts
├── features/
│   ├── auth/
│   ├── audit/
│   ├── billing/
│   ├── catalog/
│   ├── clients/
│   ├── dashboard/
│   ├── integrations/
│   └── orders/
└── lib/
    ├── env.ts
    ├── errors.ts
    ├── money.ts
    └── validation.ts

tests/
├── contract/
├── e2e/
├── integration/
└── unit/
```

**Structure Decision**: A single Next.js application keeps server rendering, actions, route
handlers, and UI in one deployable unit while feature folders preserve business boundaries. Direct
database access is restricted to server-only modules. External provider payloads are restricted to
integration adapters.

## Complexity Tracking

No constitution violations require justification.
