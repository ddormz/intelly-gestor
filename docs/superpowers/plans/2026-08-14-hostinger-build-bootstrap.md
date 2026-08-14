# Hostinger Build Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ejecutar migraciones y bootstrap del administrador desde el build estándar que Hostinger sí respeta.

**Architecture:** Un módulo compartido ejecuta el bootstrap existente. Un script `prebuild` lo invoca cuando hay `DATABASE_URL`, mientras `start-production.ts` reutiliza la misma función.

**Tech Stack:** Node.js 22, TypeScript, npm lifecycle, MySQL2, Drizzle ORM, Node test runner.

## Global Constraints

- No exponer secretos en código, logs ni pruebas.
- Mantener migraciones y creación del administrador idempotentes y serializadas con `GET_LOCK`.
- Permitir builds locales sin MySQL cuando el bootstrap no esté habilitado.

---

### Task 1: Bootstrap compartido durante prebuild

**Files:**
- Create: `src/bootstrap/production.ts`
- Create: `scripts/bootstrap-build.ts`
- Modify: `scripts/start-production.ts`
- Modify: `package.json`
- Test: `tests/deployment-config.test.mjs`

**Interfaces:**
- Consumes: `parseBootstrapAdminConfig`, `createMySqlBootstrap`, `runStartupBootstrap`.
- Produces: `runProductionBootstrap(env: NodeJS.ProcessEnv): Promise<void>`.

- [ ] **Step 1: Escribir la prueba fallida**

  Hacer que la prueba ejecute `npm run prebuild` sin credenciales y exija salida exitosa, además de
  comprobar que el lifecycle existe.

- [ ] **Step 2: Verificar RED**

  Run: `node --test tests/deployment-config.test.mjs`
  Expected: FAIL porque `prebuild` todavía no existe.

- [ ] **Step 3: Implementar lo mínimo**

  Extraer el bootstrap compartido, añadir el script de build y registrar
  `"prebuild": "tsx scripts/bootstrap-build.ts"`.

- [ ] **Step 4: Verificar GREEN y regresiones**

  Run: `node --test tests/deployment-config.test.mjs`
  Expected: PASS.

  Run: `npm run lint && npm run typecheck && npm test && npm run build`
  Expected: todos los comandos terminan con código 0.

- [ ] **Step 5: Commit y push**

  Commit: `fix: bootstrap database during managed builds`
