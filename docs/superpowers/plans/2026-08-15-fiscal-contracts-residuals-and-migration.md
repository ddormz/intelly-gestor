# Plan de Corrección de Migración MySQL y Cierre de Residuales Fiscales IntellyDTE

> **Para trabajadores agenticos:** SUB-SKILL REQUERIDA: Usar `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para implementar este plan tarea por tarea. Los pasos usan sintaxis de checklist (`- [ ]`) para tracking.

**Meta:** Corregir el error de migración `ER_DROP_INDEX_FK` en MySQL, solucionar los residuales de contratos fiscales DTE 33 (estados SII SOA/RPR/DNK/FAN/RCT, redacción de trazas fiscales, validación estricta de XML, reintentos en colisión de evidencias y cabecera de codificación XML ISO-8859-1) y lograr 100% de tests unitarios y de integración pasando.

**Arquitectura:** 
1. Reordenamiento DDL en la migración `0009_broken_warbird.sql` para garantizar que la foreign key `invoice_evidence(invoice_id)` mantenga un índice válido durante la transición y añadir la columna faltante `encoding`.
2. Corrección del parser de XML fiscal en `xml.ts` para validar totales y líneas estrictamente según normativa SII sin fallar por campos opcionales ausentes antes de tiempo.
3. Clasificación exacta de estados SII en el gateway y webhooks de IntellyDTE (rechazados, observados y aceptados).
4. Extensión de redacción de secretos fiscales en trazas y manejo robusto de colisiones de versiones de evidencia.

**Stack Tecnológico:** Next.js 15, Drizzle ORM, MySQL 8 / MySQL2, Vitest, Fast-XML-Parser, bwip-js.

---

## Tareas Propuestas

### Tarea 1: Corregir el error de migración MySQL (ER_DROP_INDEX_FK) y columna `encoding`

**Archivos:**
- Modificar: `src/db/migrations/0009_broken_warbird.sql`
- Modificar: `src/db/migrations/meta/0009_snapshot.json`

**Problema diagnosticado:**
MySQL requiere que las columnas de clave foránea (`invoice_id`) tengan un índice en todo momento. En `0009_broken_warbird.sql`, se ejecutaba `DROP INDEX invoice_evidence_kind_uq` seguido de `DROP INDEX invoice_evidence_invoice_idx` antes de crear el nuevo constraint `invoice_evidence_version_uq`. Al intentar eliminar ambos índices existentes, la clave foránea quedaba huérfana de índice, lanzando `ER_DROP_INDEX_FK (errno 1553)`. Además faltaba la columna `encoding` en el DDL.

- [ ] **Paso 1: Reordenar DDL en `0009_broken_warbird.sql`**
  1. Agregar `ALTER TABLE invoice_evidence ADD version int DEFAULT 1 NOT NULL;` y `ALTER TABLE invoice_evidence ADD encoding varchar(30);`.
  2. Agregar `ALTER TABLE invoice_evidence ADD CONSTRAINT invoice_evidence_version_uq UNIQUE(invoice_id, kind, version);` (satisface la foreign key).
  3. Ejecutar `ALTER TABLE invoice_evidence DROP INDEX invoice_evidence_kind_uq;`.
  4. Ejecutar `DROP INDEX invoice_evidence_invoice_idx ON invoice_evidence;`.
  5. Ejecutar `CREATE INDEX invoice_evidence_invoice_idx ON invoice_evidence (invoice_id, kind, version);`.
  6. Incluir las alteraciones restantes de `integration_attempts`, `integration_configs`, `intellydte_webhook_events` e `invoices`.

- [ ] **Paso 2: Verificar snapshot de Drizzle**
  Asegurar consistencia del esquema en `0009_snapshot.json`.

---

### Tarea 2: Corregir Parser y Contratos de Validación XML Fiscal DTE 33

**Archivos:**
- Modificar: `src/features/billing/xml.ts`
- Modificar: `tests/unit/fiscal-xml-pdf.test.ts`
- Modificar: `tests/unit/billing-emission.test.ts`
- Modificar: `tests/unit/fiscal-orchestration.test.ts`

**Problema diagnosticado:**
1. `parseSignedDteXml` fallaba con `DTE_XML_INVALID_LINE` antes de validar los totales requeridos (`DTE_XML_INVALID_NET`) porque procesaba las líneas primero y exigía `NroLinDet` en lugar de default `index + 1`.
2. Las líneas con montos negativos o precios faltantes no estaban validadas en el orden estricto de los contratos SII.
3. El mock en `fiscal-orchestration.test.ts` tenía `details: []` lo que causaba un desacople con las líneas de la orden y generaba `status: pending` en lugar de `issued`.

- [ ] **Paso 1: Ajustar `parseSignedDteXml` en `src/features/billing/xml.ts`**
  - Validar encabezado (`IdDoc`, `Emisor`, `Receptor`, `Totales`) antes de procesar `Detalle`.
  - Exigir `MntNeto` (`DTE_XML_INVALID_NET`) y `MntTotal` (`DTE_XML_INVALID_TOTAL`).
  - En `Detalle`, permitir que `NroLinDet` tome por defecto `index + 1` si no está presente, y exigir `PrcItem` (`DTE_XML_INVALID_LINE_PRICE`) y `MontoItem` (`DTE_XML_INVALID_LINE_AMOUNT`), rechazando valores negativos.
  - Asegurar decodificación y encoding `ISO-8859-1` como estándar DTE chileno.

- [ ] **Paso 2: Ajustar fixtures y mocks en los tests**
  - Ajustar el mock de `details` en `tests/unit/fiscal-orchestration.test.ts` para que concuerde con las líneas de la orden emitida.
  - Ejecutar `vitest run tests/unit/fiscal-xml-pdf.test.ts tests/unit/billing-emission.test.ts tests/unit/fiscal-orchestration.test.ts`.

---

### Tarea 3: Cerrar Residuales de Clasificación de Estados SII (SOA/RPR/DNK/FAN/RCT) y Webhooks

**Archivos:**
- Modificar: `src/features/integrations/intellydte.ts`
- Modificar: `src/features/billing/emission.ts`
- Modificar: `tests/unit/intellydte-gateway.test.ts`
- Modificar: `tests/unit/fiscal-webhook-route.test.ts`

**Detalles de implementación:**
- En `intellydte.ts` y `handleIntellyDteWebhook` en `emission.ts`:
  - Clasificar formalmente:
    - **Aceptados (`DOK`, `ACCEPTED`, `ACEPTADO`)**: si hay XML firmado y orden coincidente -> `issued`.
    - **Observados/Revisión (`SOA`, `REVIEW`, `OBSERVED`, `OBSERVADO`)**: estado `pending` / `processing`, nunca `issued`.
    - **Rechazados (`RPR`, `DNK`, `FAN`, `RCT`, `REJECT`, `RECHAZ`, `FAILED`, `ERROR`, `INVALID`)**: estado `rejected`, nunca `issued`.
  - Asegurar que `fakeSignedXml` incluya la cabecera `<?xml version="1.0" encoding="ISO-8859-1"?>` y los datos del TED completos.

---

### Tarea 4: Ampliar Redacción de Trazas Fiscales y Reintentos en Colisión de Evidencia

**Archivos:**
- Modificar: `src/lib/errors.ts`
- Modificar: `src/features/billing/evidence.ts`
- Modificar: `tests/unit/fiscal-redaction.test.ts`
- Modificar: `tests/unit/fiscal-evidence.test.ts`

**Detalles de implementación:**
- En `src/lib/errors.ts`:
  - Ampliar `secretKeys` para cubrir todas las claves fiscales sensibles (`signed_xml`, `signedXmlBase64`, `timbre`, `tedXml`, `pdf417PngBase64`, `cert`, `private_key`, `key_content`, `auth_tag`, etc.).
- En `src/features/billing/evidence.ts`:
  - En `storeArtifact`, mejorar la detección de errores de duplicado (`ER_DUP_ENTRY`, errno 1062, o `invoice_evidence_version_uq`) para reintentar la asignación de versión incrementada hasta 5 veces.

---

### Tarea 5: Verificación Integral de la Suite de Tests

- [ ] **Paso 1: Ejecutar la suite completa con `cmd.exe /c "npm test"`**
  - Confirmar 46 suites de prueba pasando (195+ tests unitarios y de integración).
- [ ] **Paso 2: Ejecutar verificación de build con `cmd.exe /c "npm run build"`**
  - Asegurar compilación limpia sin errores de tipos ni de migración.
