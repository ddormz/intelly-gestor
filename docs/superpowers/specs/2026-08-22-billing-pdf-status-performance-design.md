# Facturación: PDF tributario, estado compacto y carga diferida

**Fecha:** 2026-08-22  
**Estado:** Aprobado por el usuario

## Objetivo

Al emitir una factura electrónica, Intelly Gestor debe materializar automáticamente el PDF tributario desde el XML firmado entregado por IntellyDTE. La vista de Facturación debe mostrar el estado como un ícono junto al folio, siguiendo el patrón de Documentos de Bevox, y debe entrar más rápido sin quedar bloqueada por la consulta remota de folios.

## Contexto confirmado

- El contrato local de IntellyDTE entrega `printPayload.signedXmlBase64` junto con el folio, el tipo DTE y el TED/PDF417.
- En producción IntellyDTE no garantiza un PDF físico final; el consumidor debe construirlo.
- El proyecto ya tiene parser XML, renderer fiscal con `jsPDF`/`jspdf-autotable`/`bwip-js` y almacenamiento privado de evidencia.
- La emisión y el webhook ya persisten estado fiscal, pero la materialización está acoplada a `emission.ts` y puede dejar la evidencia en estado pendiente.
- La carga inicial de `/facturacion` espera `getFoliosStatus()`, una llamada remota que puede consumir el timeout completo del gateway.
- Bevox muestra un ícono compacto con `title` y `aria-label` inmediatamente antes del número de documento.

## Decisiones de diseño

### 1. Materialización de evidencia fiscal

Se extraerá una frontera reutilizable para materializar evidencia fiscal. La entrada será el identificador de factura, el XML firmado en Base64 y los valores esperados de emisor, tipo DTE y folio.

El flujo será:

1. Decodificar y validar el Base64 sin registrar el contenido fiscal.
2. Parsear el XML firmado con selectores tolerantes a namespaces.
3. Validar que corresponda a una Factura Electrónica DTE 33, al emisor configurado, al receptor, al folio y a los montos/líneas de la orden.
4. Guardar los bytes originales del XML como evidencia privada.
5. Generar el PDF tributario local usando el documento parseado y su TED original para producir el PDF417.
6. Guardar el PDF como evidencia privada y marcar `evidenceStatus` como `complete`.

La misma frontera será usada por:

- la respuesta inmediata de emisión cuando incluya XML firmado;
- el webhook cuando la emisión sea asíncrona;
- la recuperación de evidencia existente sin volver a llamar a `issueInvoice`.

Si la factura ya fue aceptada pero falta XML o falla la generación del PDF, la factura conservará `status: issued`, el pedido conservará `status: invoiced` y sólo la evidencia quedará pendiente o fallida, con mensaje seguro y opción de reintento. No se consumirá otro folio ni se hará una segunda emisión.

No se usará `pdf`, `pdfUrl` ni ningún PDF físico entregado por el proveedor.

### 2. Estado compacto en Documentos

La columna textual independiente `Estado` se eliminará de la tabla de Facturación. El folio renderizará un componente de estado inmediatamente a su lado.

El componente será accesible y conservará el significado textual mediante `title` y `aria-label`:

- aceptación SII/DOK: ícono de confirmación verde;
- pendiente o encolado: reloj ámbar;
- procesando o en revisión: reloj/carga azul o ámbar;
- observado: advertencia ámbar;
- rechazado: ícono de error rojo.

El texto descriptivo no ocupará una celda ni se mostrará como badge junto al folio. Las glosas SII seguirán disponibles como descripción accesible o ayuda contextual cuando existan.

Las acciones de PDF, XML, correo, consulta y recuperación continuarán siendo icon-only, con `title`, `aria-label` y razones claras cuando estén deshabilitadas.

### 3. Entrada rápida y folios con skeleton

La página servidor de Facturación sólo esperará los datos críticos para mostrar la pantalla:

- usuario autenticado;
- facturas paginadas y su conteo;
- órdenes pagadas listas para facturar.

La consulta remota de folios se retirará de la ruta crítica. Un componente cliente autenticado solicitará los folios después de hidratarse mediante un endpoint interno de solo lectura. Mientras espera, mostrará tres tarjetas skeleton con la misma geometría de las tarjetas reales. Si la consulta falla, mostrará un estado recuperable con botón de reintento sin bloquear la tabla.

El botón de sincronización actualizará únicamente el componente de folios. La información fiscal de facturas no se cacheará de forma que pueda mostrar estados obsoletos; el endpoint de folios podrá usar `no-store`.

La consulta de facturas conservará filtros y paginación. No se hará una refactorización general de base de datos fuera de los índices y consultas directamente relacionados con esta pantalla.

## Componentes y límites

- `src/features/billing/evidence-orchestration.ts`: materialización común de XML/PDF y resultado tipado de `pending`, `complete` o `failed`.
- `src/features/billing/emission.ts`: orquestación de emisión, webhook y recuperación; conservará la propiedad del estado fiscal y no duplicará la lógica del renderer.
- `src/features/billing/presentation.ts` o equivalente: mapeo puro de estado fiscal a etiqueta, ícono, tono y disponibilidad de acciones.
- `src/app/(dashboard)/facturacion/fiscal-status-icon.tsx`: ícono accesible junto al folio.
- `src/app/(dashboard)/facturacion/folio-status-panel.tsx`: carga cliente, skeleton, error y sincronización de folios.
- `src/app/api/integrations/intellydte/folios/route.ts`: endpoint autenticado y sin caché para consultar folios.
- `src/app/(dashboard)/facturacion/page.tsx`: renderizado crítico sin esperar la consulta de folios.
- `src/app/(dashboard)/facturacion/billing-manager.tsx`: integración de iconografía, acciones y panel diferido.

Los nombres finales podrán ajustarse a los patrones del repositorio al crear el plan, pero las responsabilidades no se mezclarán.

## Manejo de errores y seguridad

- El XML firmado, TED, Base64, PDF y cuerpos sensibles del proveedor nunca se escribirán en logs ni en respuestas del endpoint de folios.
- Las rutas de descarga seguirán requiriendo sesión y devolverán evidencia privada.
- Un error de renderer no podrá convertir una factura aceptada en rechazada.
- Un reintento de evidencia nunca podrá invocar la creación de factura ni asignar un folio nuevo.
- El endpoint de folios requerirá usuario autenticado, responderá errores seguros y no expondrá API keys ni configuración del proveedor.
- Se conservará la idempotencia del webhook y de la emisión.

## Verificación

Se agregarán o ajustarán pruebas para demostrar:

1. Una respuesta de emisión con `signedXmlBase64` guarda XML y PDF automáticamente.
2. Un webhook con XML firmado materializa la misma evidencia de forma idempotente.
3. Un error de PDF conserva la factura como emitida y permite reconstruir sin reemitir.
4. El estado se representa como ícono accesible junto al folio y no como columna textual.
5. Los controles deshabilitados no navegan y explican su motivo.
6. La página no llama a `getFoliosStatus` durante el render servidor inicial.
7. El panel muestra skeletons mientras carga y permite reintentar si falla.

La entrega se verificará con pruebas Vitest focalizadas, pruebas e2e de Facturación, `npm run typecheck`, `npm run lint`, `npm run build` y `git diff --check`.

## Fuera de alcance

- Crear un sistema de colas o worker nuevo para PDFs.
- Cambiar el contrato de IntellyDTE.
- Rediseñar otras pantallas de Documentos, POS o Bevox.
- Cambiar reglas tributarias o el payload de Factura 33 salvo lo necesario para validar la evidencia.
- Reemplazar la base de datos o realizar una optimización general no relacionada con la entrada a Facturación.
