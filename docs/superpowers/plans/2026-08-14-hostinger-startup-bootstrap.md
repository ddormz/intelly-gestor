# Hostinger Startup Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar MySQL y crear el primer administrador automáticamente al iniciar en Hostinger.

**Architecture:** Un bootstrap bloqueado con `GET_LOCK` se ejecuta antes de `next start`. La creación del administrador solo ocurre con `BOOTSTRAP_ADMIN_ENABLED=true`; el health check verifica MySQL.

**Tech Stack:** Next.js 16, TypeScript, MySQL, Drizzle, Argon2id, Vitest.

## Global Constraints

- No registrar secretos.
- No cambiar un administrador existente ni elevar otro usuario.
- No iniciar Next.js si migrar o inicializar falla.
- Mantener compatibilidad con `npm ci --omit=dev`.

---

### Task 1: Bootstrap seguro e idempotente

**Files:**
- Create: `src/bootstrap/config.ts`
- Create: `src/bootstrap/admin.ts`
- Create: `src/bootstrap/startup.ts`
- Create: `src/bootstrap/mysql.ts`
- Test: `tests/unit/bootstrap.test.ts`

**Interfaces:**
- `parseBootstrapAdminConfig(env)` devuelve bootstrap deshabilitado o credenciales validadas.
- `runStartupBootstrap(config, adapter)` adquiere bloqueo, migra, crea/verifica admin y siempre cierra.

- [ ] Escribir pruebas fallidas para bootstrap deshabilitado, configuración inválida, alta inicial, administrador existente, usuario incompatible, bloqueo y limpieza tras error.
- [ ] Ejecutar `npm test -- tests/unit/bootstrap.test.ts` y confirmar RED.
- [ ] Implementar validación Zod, dominio de administrador, orquestador y adaptador MySQL con `GET_LOCK('intelly-gestor-bootstrap', 30)`.
- [ ] Ejecutar la prueba y `npm run typecheck`; confirmar GREEN.
- [ ] Commit: `feat: add secure startup bootstrap`.

### Task 2: Arranque y health check

**Files:**
- Create: `scripts/start-production.ts`
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `src/app/api/health/route.ts`
- Modify: `tests/deployment-config.test.mjs`
- Create: `tests/unit/health.test.ts`
- Modify: `docs/hostinger-deployment.md`

**Interfaces:**
- `npm start` ejecuta bootstrap y luego `next start`.
- `/api/health` devuelve 200 con MySQL disponible o 503 sin detalles internos.

- [ ] Escribir pruebas fallidas para el nuevo comando `start` y respuestas 200/503.
- [ ] Ejecutar pruebas y confirmar RED.
- [ ] Implementar entrypoint, propagación de señales, variables de ejemplo, health check y guía de retirada de `ADMIN_*`.
- [ ] Ejecutar pruebas, typecheck y build; confirmar GREEN.
- [ ] Commit: `feat: bootstrap Hostinger without terminal access`.

### Task 3: Verificación y publicación

**Files:** Solo cambios exigidos por fallos concretos.

- [ ] Ejecutar `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` y `npm run test:legacy-render`.
- [ ] En una copia temporal limpia, ejecutar `npm ci --omit=dev` y `npm run build`.
- [ ] Verificar que no existan credenciales reales y que `git diff --check` pase.
- [ ] Push y PR contra `main`, sin incluir valores secretos.
