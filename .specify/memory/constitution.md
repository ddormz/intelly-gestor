<!--
Sync Impact Report
- Version change: template -> 1.0.0
- Added principles: Security and Privacy by Default; Financial Data Integrity;
  Explicit Integration Boundaries; Testable Delivery; Accessible, Responsive UX
- Added sections: Technical and Operational Constraints; Delivery Workflow and Quality Gates
- Removed sections: none
- Deferred TODOs: none
-->

# Intelly Gestor Constitution

## Core Principles

### I. Security and Privacy by Default (NON-NEGOTIABLE)
Authentication, authorization, session handling, secrets, and personal data MUST follow secure
defaults. Passwords MUST use a modern adaptive hash, sensitive operations MUST enforce server-side
authorization, login abuse MUST be rate-limited, sessions MUST be revocable, and credentials MUST
never be committed or exposed to the browser. Security controls require automated tests and an
auditable failure path because the product handles customer and billing information.

### II. Financial Data Integrity (NON-NEGOTIABLE)
Amounts MUST use exact decimal arithmetic and retain currency and tax context. Payment-order and
invoice transitions MUST be explicit, validated, idempotent, and auditable. External callbacks and
retries MUST NOT create duplicate charges, orders, or fiscal documents. Historical financial facts
MUST remain traceable instead of being silently overwritten.

### III. Explicit Integration Boundaries
MySQL, email or delivery providers, and IntellyDTE MUST be accessed through documented adapters with
validated inputs, bounded timeouts, retry rules, and observable errors. Provider-specific payloads
MUST NOT leak into core business logic. Local development and automated tests MUST work without live
provider credentials through deterministic fakes or contract fixtures.

### IV. Testable Delivery
Every user-visible behavior and business rule MUST have an executable acceptance path. Unit tests
cover domain rules, integration tests cover persistence and adapter contracts, and end-to-end tests
cover the critical login-to-invoice workflow. A change is complete only when relevant tests, static
analysis, and production build checks pass with no ignored critical failures.

### V. Accessible, Responsive UX
Primary workflows MUST be usable by keyboard, screen reader, and touch; meet WCAG 2.2 AA contrast
and focus expectations; and remain functional from a 375 px viewport through desktop layouts.
Loading, empty, success, and error states MUST be explicit. Destructive or irreversible financial
actions MUST require clear confirmation and communicate their outcome without relying on color alone.

## Technical and Operational Constraints

- The application MUST keep secrets in runtime environment variables and provide a safe example file
  containing placeholders only.
- Database schema changes MUST be migration-based, reversible when feasible, and reviewed for data
  loss risk before execution against Hostinger.
- Production transport MUST use TLS. Database connections MUST support encrypted transport and the
  least-privileged database account supported by the host.
- Logs MUST use structured events, redact secrets and personal data, and include correlation IDs for
  payment-order and invoice operations.
- External operations MUST expose actionable status to operators and preserve enough metadata for a
  safe retry without duplicating business effects.

## Delivery Workflow and Quality Gates

1. Each material change starts with a reviewed specification, implementation plan, and dependency-
   ordered task list.
2. Risks involving authentication, authorization, financial state, schema migrations, and external
   integrations require explicit acceptance criteria before implementation.
3. Implementation follows small, reviewable increments with tests added alongside each behavior.
4. Before completion, the team MUST run the relevant automated tests, type or static checks,
   production build, and a security-focused review of changed trust boundaries.
5. Deferred provider verification MUST be documented with exact credentials, sandbox accounts, and
   live-environment checks still required; it MUST NOT be represented as completed.

## Governance

This constitution supersedes conflicting local conventions. Amendments require a written rationale,
an impact review for existing specifications and code, and an explicit semantic-version change:
MAJOR for incompatible governance changes, MINOR for new or materially expanded obligations, and
PATCH for clarifications. Every specification, plan, task list, and code review MUST verify applicable
principles. Exceptions require a documented owner, scope, expiry condition, and remediation plan.

**Version**: 1.0.0 | **Ratified**: 2026-08-12 | **Last Amended**: 2026-08-12
