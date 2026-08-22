# Diseño: estado fiscal por webhook y representación tributaria local

**Fecha:** 2026-08-22
**Estado:** aprobado para planificación

## Contexto comprobado

La factura real de prueba fue aceptada por el SII, pero permaneció localmente en `pending`.
La evidencia observada en producción muestra:

- IntellyDTE notificó `dte.accepted` con `dteRecordId`, pero sin `tenantRut`.
- El manejador exige actualmente ambos valores y confirmó el evento sin asociarlo a la factura.
- La factura conserva `siiStatus = DOK`, glosa con un documento aceptado y `evidenceStatus = pending`.
- La respuesta de emisión de IntellyDTE contiene `printPayload.ready = true`, XML firmado en
  `printPayload.signedXmlBase64`, TED y PDF417.
- `pdf.letterAvailable = false` y `pdf.thermalAvailable = false`: IntellyDTE no entrega una
  representación PDF terminada. Intelly Gestor debe construirla localmente.
- Las acciones de PDF, XML y correo ya existen, pero la interfaz sólo las muestra cuando el estado
  local es `issued` y la evidencia correspondiente existe.

No se copiarán el XML firmado, TED, PDF417, claves, payloads fiscales reales ni otros secretos a
este repositorio, pruebas, logs o documentación.

## Objetivos

1. Tratar los webhooks de IntellyDTE como fuente autoritativa del resultado SII.
2. Cambiar automáticamente una factura a aceptada o rechazada aunque la disponibilidad de archivos
   tenga un ciclo diferente.
3. Construir el PDF tributario dentro de Intelly Gestor desde el XML firmado y su TED/PDF417.
4. Mostrar estados con icono, texto y color accesible.
5. Mantener visibles las acciones de descargar PDF, descargar XML y enviar por correo, explicando
   cuándo todavía están preparando la evidencia.
6. Conservar idempotencia y evitar reemisiones o envíos duplicados.

## Fuera de alcance

- Consumir un PDF generado por IntellyDTE.
- Publicar XML o PDF en URLs anónimas.
- Cambiar el contrato tributario o construir un DTE desde datos no firmados.
- Emitir una segunda factura para recuperar evidencia.
- Copiar literalmente estilos privados de Bevox; se adopta su patrón de icono más etiqueta y
  acciones compactas con tooltip dentro del sistema visual existente.

## Modelo de estados

Se mantienen los campos existentes y se separan sus responsabilidades:

### Estado fiscal (`invoices.status`)

| Valor interno | Presentación | Significado |
| --- | --- | --- |
| `pending` | Pendiente | IntellyDTE recibió la solicitud, sin resultado SII terminal. |
| `processing` | Procesando | El documento está en cola, cargado o requiere revisión. |
| `issued` | Aceptada | El SII aceptó el DTE. No depende de que el PDF ya esté construido. |
| `rejected` | Rechazada | IntellyDTE o el SII rechazó el documento. |

`issued` se conserva como valor interno para evitar una migración destructiva del enum, pero la
interfaz fiscal lo presenta como **Aceptada**. Una aceptación actualiza también la orden pagada a
`invoiced` y registra `issuedAt`.

### Estado de evidencia (`invoices.evidenceStatus`)

| Valor | Presentación | Significado |
| --- | --- | --- |
| `pending` | Generando archivos | Falta XML validado o PDF reconstruido. |
| `complete` | Archivos disponibles | XML firmado y PDF local están disponibles. |
| `failed` | Error de archivos | Falló la validación, persistencia o reconstrucción; se puede reintentar sin reemitir. |

Un fallo de evidencia nunca revierte una aceptación SII ni vuelve a emitir el DTE.

## Ingesta de la respuesta de emisión

El adaptador normaliza las variantes reales del proveedor antes de aplicar lógica fiscal:

- raíz directa `data`;
- envoltorio `body.data` cuando corresponda;
- `printPayload` como objeto JSON;
- `folio`, `tipoDte`, `dteRecordId`, `trackId`, `siiStatus` y `siiGlosa`.

Cuando `printPayload.ready` y `signedXmlBase64` están disponibles:

1. Decodificar base64 con límites de tamaño.
2. Parsear el XML firmado con selectores seguros para namespaces.
3. Verificar DTE 33, folio, emisor, receptor, fecha, totales y detalle contra la orden.
4. Persistir el XML firmado como evidencia privada con SHA-256.
5. Construir el PDF local usando los datos del XML y el TED/PDF417 original.
6. Persistir el PDF con SHA-256 y versión del renderer.

La bandera `pdf.*Available` del proveedor es informativa y no es una fuente de PDF.

## Procesamiento de webhooks

El endpoint conserva la verificación HMAC sobre el cuerpo crudo y la deduplicación por `eventId`.

### Correlación

1. Requerir `dteRecordId` para eventos dirigidos.
2. Buscar por `invoices.providerDocumentId`, que ya tiene índice único.
3. Si el evento incluye `tenantRut`, exigir que coincida con la factura.
4. Si el evento omite `tenantRut`, usar el `tenantRut` persistido en la factura y no sobrescribirlo
   con `null`.
5. Si no hay coincidencia o el RUT contradice la factura, registrar el resultado seguro y confirmar
   sin alterar documentos.

### Transiciones

- `dte.enqueued` y `dte.uploaded`: `processing` salvo estado terminal local.
- `dte.review_required`: `processing`, conservando glosa y trazabilidad.
- `dte.accepted`: `issued`/Aceptada inmediatamente, aun con evidencia pendiente.
- `dte.rejected`: `rejected`, salvo que ya exista una aceptación terminal.
- eventos duplicados: respuesta exitosa sin repetir auditoría, generación ni correo.

La actualización de factura, orden, evento webhook y auditoría ocurre en una transacción. Ninguna
llamada de red ni envío de correo se ejecuta dentro de esa transacción.

## Recuperación de evidencia

La respuesta de emisión es la fuente primaria del XML firmado. El sistema debe intentar
materializarla antes de esperar la aceptación asíncrona.

Si el DTE queda aceptado con evidencia incompleta:

- no se crea otra factura;
- se conserva `evidenceStatus = pending` o `failed` con un error seguro;
- la consulta manual de estado puede recuperar nueva información del proveedor y reintentar la
  materialización sólo si obtiene XML firmado;
- se ofrece una acción explícita de reintento de archivos cuando el proveedor vuelva a exponer el
  `printPayload`;
- el documento real afectado puede repararse mediante una operación administrativa controlada a
  partir de su respuesta original, sin guardar esa respuesta en Git.

## Interfaz

El estado fiscal usa Lucide y siempre combina icono, etiqueta y color:

| Estado | Icono | Tratamiento |
| --- | --- | --- |
| Pendiente | `Clock3` | advertencia |
| Procesando | `LoaderCircle` | informativo; animación respeta reducción de movimiento |
| Aceptada | `BadgeCheck` | éxito |
| Rechazada | `CircleX` | error |

El componente de estado incluye texto visible; el color nunca es el único indicador.

Las acciones por fila mantienen controles compactos con tooltip y nombre accesible:

- **Descargar PDF tributario**: visible siempre; habilitado cuando existe PDF reconstruido.
- **Descargar XML firmado**: visible siempre; habilitado cuando existe XML validado.
- **Enviar por email**: visible siempre; habilitado cuando el PDF está disponible; adjunta también
  XML cuando existe.
- **Actualizar estado**: disponible mientras el estado fiscal no sea terminal.
- **Reintentar archivos**: disponible cuando la factura está aceptada y la evidencia está pendiente
  o fallida.

Un control deshabilitado muestra la razón: “Generando documento tributario” o “Archivos fiscales
no disponibles; reintenta la generación”. Los objetivos táctiles mantienen al menos 44 × 44 px y
son utilizables con teclado.

## Correo

El envío manual usa el destinatario registrado o uno alternativo validado. Consume únicamente la
evidencia privada persistida, registra auditoría y no modifica el estado SII. Repetir la acción es
una decisión explícita del usuario; los reintentos técnicos del mismo envío deben ser idempotentes.

## Errores y observabilidad

- Persistir códigos seguros para firma inválida, evento sin destino, RUT contradictorio, XML
  ausente, XML inválido y reconstrucción fallida.
- Registrar `eventId`, `dteRecordId`, estado anterior/nuevo y estado de evidencia.
- Nunca registrar cuerpo XML, TED, PDF417, PDF, API keys, secretos HMAC ni datos base64.
- Un webhook aceptado debe devolver 2xx después de quedar durablemente registrado, incluso si la
  generación de evidencia queda pendiente.

## Pruebas de aceptación

1. `dte.accepted` sin `tenantRut` encuentra una factura por `dteRecordId` único y la cambia a
   `issued`/Aceptada.
2. Un evento con RUT contradictorio no modifica la factura.
3. Repetir el mismo `eventId` no duplica transiciones, auditoría ni generación.
4. La aceptación actualiza la orden a `invoiced` aunque `evidenceStatus` siga pendiente.
5. La respuesta real con `printPayload.signedXmlBase64` produce XML persistido y PDF reconstruido
   localmente; nunca consume un PDF del proveedor.
6. Un fallo del renderer conserva la factura aceptada y deja evidencia reintentable.
7. Los cuatro estados muestran icono más texto.
8. PDF, XML y email están visibles en todas las filas, con habilitación y explicación correctas.
9. El envío de correo adjunta el PDF local y el XML cuando existe.
10. La suite, typecheck, lint, build y migraciones sobre MySQL desechable pasan antes del despliegue.

## Reparación del documento actual

Después de desplegar y verificar el comportamiento general, el documento de folio 22 requiere una
reparación controlada:

1. Ingerir de forma segura su respuesta original sin registrarla ni versionarla.
2. Validar y persistir el XML firmado.
3. Construir y persistir el PDF local.
4. Conciliar el evento `dte.accepted` ya registrado.
5. Confirmar estado Aceptada, descarga autenticada y envío de prueba sólo con autorización.
