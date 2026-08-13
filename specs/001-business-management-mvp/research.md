# Phase 0 Research: Intelly Gestor MVP

## Web application runtime

**Decision**: Use Next.js 16 App Router with TypeScript on Node.js 24.

**Rationale**: The repository is empty, so a server-rendered monolith provides the shortest secure
path to authenticated pages, server-side data access, mutations, and route contracts without a
second deployment. Next.js 16 requires Node 20.9 or newer, and the installed Node 24 runtime is
compatible. Server Components keep database queries off the browser; Server Actions and route
handlers remain public trust boundaries and will authorize and validate every input.

**Alternatives considered**: Separate React SPA plus API (more CORS, token, and deployment surface),
NestJS plus separate frontend (strong structure but excessive for the initial scope), Laravel
(viable on Hostinger but would introduce a second local toolchain not present in the repository).

**Sources**: [Next.js installation](https://nextjs.org/docs/app/getting-started/installation),
[Next.js deployment](https://nextjs.org/docs/app/getting-started/deploying)

## MySQL access and migrations

**Decision**: Use `mysql2` pooled connections through Drizzle ORM, with code-first SQL migrations
committed to the repository. Use one dedicated connection when applying DDL migrations.

**Rationale**: Hostinger supports MySQL for managed hosting and documents environment-based Node.js
connections and reuse through a pool. Drizzle supplies typed schemas, explicit migrations,
transactions, and a thin abstraction suitable for financial queries. The pool is intentionally
small and reused by the process to avoid connection churn.

**Alternatives considered**: Prisma (excellent tooling but a larger generated runtime and more
deployment considerations), raw SQL only (small dependency surface but weaker schema/type linkage),
PHP PDO (native to shared hosting but conflicts with the selected application runtime).

**Sources**: [Hostinger Node.js and MySQL guide](https://www.hostinger.com/support/connecting-a-hostinger-mysql-database-to-a-node-js-application/),
[Hostinger remote MySQL allowlisting](https://support.hostinger.com/en/articles/1583546-how-to-set-up-remote-mysql-access-in-hostinger),
[Drizzle MySQL](https://orm.drizzle.team/docs/mysql/get-started-mysql),
[Drizzle migrations](https://orm.drizzle.team/docs/migrations),
[Drizzle transactions](https://orm.drizzle.team/docs/transactions)

## Authentication and sessions

**Decision**: Use administrator-created email/password accounts, Argon2id password hashes, random
opaque session tokens, SHA-256 token digests in MySQL, and `HttpOnly; Secure; SameSite=Lax` cookies.
Rotate the token after login, expire it after 30 minutes of inactivity and 12 hours absolute, and
support immediate revocation. Apply generic login errors, constant-shape verification, and database-
backed throttling by normalized email and IP.

**Rationale**: Opaque server sessions are directly revocable and avoid putting authorization state
inside browser-readable storage. Argon2id is OWASP's preferred password-storage algorithm. Same-site
cookies plus strict Origin/Host verification on mutations mitigate CSRF while retaining normal link
navigation. A small internal deployment does not need Redis to enforce abuse limits.

**Alternatives considered**: JWT in local storage (not revocable enough and explicitly discouraged
for browser credentials), hosted identity provider (strong future option but not requested), bcrypt
(acceptable legacy fallback but not preferred for a new system).

**Sources**: [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html),
[OWASP Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html),
[OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)

## CSRF, input validation, and authorization

**Decision**: Mutations accept same-origin requests only, validate content and Zod schemas on the
server, authorize against the current session at the action boundary, and re-check sensitive state
inside the database transaction. Public payment-order views are read-only and use hashed,
high-entropy expiring tokens.

**Rationale**: Server Actions are remotely invocable endpoints; hiding controls is not authorization.
Origin checks, same-site cookies, strict validation, and transaction-time state validation form
separate defenses without introducing a client-held bearer token.

**Alternatives considered**: Client validation only (untrusted), a synchronizer CSRF token on every
form (can be added later; origin checking and same-site cookies are sufficient for this same-origin
MVP when enforced consistently), unrestricted public numeric order IDs (enumerable and unsafe).

## Money, state, and idempotency

**Decision**: Store monetary amounts in fixed decimal columns, calculate through integer minor-unit
helpers in application code, and preserve issued order-line snapshots. Use explicit state transition
functions, database transactions, unique idempotency keys, and one invoice per order.

**Rationale**: Floating point arithmetic and implicit state edits are unacceptable for financial
records. Unique constraints provide the final duplicate barrier even if a retry races with the
original request. Invoice adapter calls carry a stable business idempotency key and normalized
request hash.

**Alternatives considered**: JavaScript floating point values (rounding risk), editable issued orders
(destroys auditability), provider-only idempotency (unknown until IntellyDTE contract is supplied).

## IntellyDTE integration

**Decision**: Define an internal adapter contract now, ship a deterministic fake for development and
tests, and enable the HTTP adapter only when base URL, credentials, company identity, sandbox details,
and the provider's current contract are supplied. Persist attempts and normalized results, use bounded
timeouts, redact raw secrets, and reconcile unknown outcomes before retrying.

**Rationale**: No public, authoritative IntellyDTE API contract was discoverable. Inventing endpoints
or payloads would falsely claim an integration. The adapter allows the rest of the product and its
idempotency guarantees to be implemented without coupling to guessed provider behavior.

**Alternatives considered**: Calling guessed endpoints (unsafe), integrating directly with SII in the
MVP (materially larger certification and XML-signing scope), blocking all development on credentials
(unnecessary because the boundary can be specified and faked).

## Dashboard and design system

**Decision**: Use the persisted Soft UI Evolution design in
`design-system/intelly-gestor/MASTER.md`: navy primary, green paid/accent, neutral surfaces, Poppins
headings, Open Sans body, dense 4/8 px rhythm, subtle 150–300 ms motion, Lucide icons, metric cards,
a revenue line chart, and textual/table fallbacks. The sidebar collapses to a modal drawer on small
screens.

**Rationale**: The scheme communicates financial trust while maintaining strong contrast and dense
operational scanning. Semantic landmarks, a skip link, visible focus, inline announced errors,
minimum 44 px targets, reduced motion, and non-color status labels support the constitution.

**Alternatives considered**: Neumorphism (insufficient contrast), fully dark interface (not requested
and raises chart/form contrast work), client-only dashboard fetching (slower initial data and more
loading complexity).

## Testing and deployment

**Decision**: Use Vitest for pure domain and action tests, Testing Library for client components,
Playwright for login/order/invoice workflows, and Docker Compose MySQL for local integration tests.
Build as a standard Node server and configure production entirely through environment variables.

**Rationale**: The suite maps directly to the risk boundaries. Hostinger documents restarting Node
applications after environment changes. A normal Node deployment retains all App Router features.

**Alternatives considered**: Unit tests only (misses schema and browser/security integration), static
export (cannot securely execute server behavior), production database for tests (unsafe).
