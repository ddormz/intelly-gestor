# Security and Deployment Verification

**Created**: 2026-08-12

- [x] Password storage uses Argon2id with OWASP baseline parameters
- [x] Browser sessions use opaque random tokens, hashed persistence, HttpOnly cookies, and revocation
- [x] Login failures are generic and throttled by hashed identity context
- [x] Internal routes and mutations enforce server-side authorization
- [x] Mutations enforce the configured same origin
- [x] Public order tokens are high entropy, hashed, expiring, and revocable
- [x] Secrets are absent from repository configuration examples and client-visible integration status
- [x] Financial transitions and provider calls use transaction/idempotency boundaries
- [x] Lint, typecheck, unit tests, migration generation, and production build pass
- [ ] MySQL migration and integration tests pass against a running disposable MySQL instance
- [ ] Browser acceptance and automated accessibility tests pass against a migrated local environment
- [ ] Hostinger MySQL TLS, allowlisted network path, backup, and least-privilege account are verified
- [ ] IntellyDTE authoritative HTTP contract and sandbox scenarios are verified

## Notes

Docker Desktop was not running during this delivery, so database-backed and browser checks remain
open. Live Hostinger and IntellyDTE checks require credentials and provider documentation that were
not available. These gates MUST pass before production deployment.
