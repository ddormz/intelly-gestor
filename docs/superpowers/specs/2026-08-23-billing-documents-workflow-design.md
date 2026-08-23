# Facturación, documentos tributarios y flujo de órdenes

## Contexto

La facturación actualmente reconstruye un PDF local desde el XML firmado de IntellyDTE. El XML firmado que entrega el proveedor se construye como una cadena UTF-8, aunque conserva una declaración XML `encoding="ISO-8859-1"`; el gestor lo decodifica únicamente por la declaración y produce mojibake en el PDF y en la descarga XML. La interfaz también muestra la acción de regeneración aun cuando ya existe un PDF, el envío de facturas depende de SMTP/PDF sin un diagnóstico suficientemente claro y la emisión exige que la orden esté pagada.

Los PDFs adjuntos se consideran referencias visuales: `factura-24 (1).pdf` representa la salida actual de Intelly y `factura_ORD-20260807-0002.pdf` representa el estilo tributario de Bevox. El segundo no se copiará; se usará únicamente para identificar una jerarquía documental más clara.

## Objetivos

1. Representar correctamente caracteres acentuados y `ñ` en PDF y XML descargado, preservando los bytes originales del XML firmado.
2. Ocultar la regeneración cuando el PDF ya existe.
3. Hacer el envío de la factura más confiable y diagnosticable, manteniendo el PDF y XML como adjuntos.
4. Mejorar el PDF con una composición A4 compacta y reconocible como documento tributario real.
5. Permitir emitir factura desde una orden emitida, sin registrar pago ni navegar a Facturación.
6. Mantener la confirmación del SII como fuente de verdad para marcar la orden como facturada.

## Diseño aprobado

### 1. Codificación del XML

- `decodeSignedDteXml` intentará decodificar primero como UTF-8 estricto cuando los bytes sean una secuencia UTF-8 válida; si no lo son, usará Latin-1/Windows-1252 según la declaración.
- La decisión se probará tanto con bytes UTF-8 cuya declaración diga ISO-8859-1 como con bytes Latin-1 reales.
- El artefacto firmado se almacenará y adjuntará con sus bytes originales. No se reemplazará el contenido firmado ni se calculará una versión “redacted”.
- La metadata de encoding del artefacto se derivará de los bytes efectivos para que la descarga anuncie UTF-8 cuando corresponda.

### 2. PDF tributario

El renderer seguirá siendo local y síncrono, usando el XML como fuente de verdad. La página A4 tendrá:

- Encabezado con emisor, RUT, giro/dirección y caja oficial de factura electrónica.
- Bloque de receptor con razón social, RUT, giro, dirección, comuna/ciudad y fechas.
- Sección de detalle con columnas tributarias legibles, wrapping de texto y filas alternadas discretas.
- Sección de pagos/vencimiento cuando exista información disponible.
- Resumen de neto, exento, IVA, descuentos y total.
- TED PDF417, resolución y verificación SII.
- Pie de acuse/cedible únicamente cuando el contenido quepa sin crear una página vacía; los detalles extensos continuarán en páginas adicionales.

El layout conservará colores de Intelly, pero priorizará densidad, alineación y jerarquía documental por sobre tarjetas decorativas. Todos los textos largos se envolverán y no se hardcodeará una unidad regional SII que el XML no entregue.

### 3. Estados y acciones de Facturación

- El folio continuará mostrando un ícono de estado adyacente.
- El `aria-label` y tooltip usarán solo etiquetas breves como `Aceptado por SII`, `Enviado al SII`, `En revisión por el SII` o `Rechazado por el SII`; no se mostrará la glosa/EPR en el icono.
- `Regenerar PDF tributario` se renderizará solo cuando la factura esté emitida y no tenga PDF. La acción de reintentar archivos seguirá disponible cuando falte XML o PDF.
- El botón de correo se habilitará solo con PDF disponible y mostrará los errores de SMTP, destinatario o evidencia de forma accionable.

### 4. Envío de facturas por correo

- Se conservará `sendInvoiceMessage` como punto único de envío y se le entregarán `Uint8Array`/bytes para PDF y XML sin conversiones destructivas.
- El XML adjunto se construirá a partir de los bytes originales, no desde una cadena redecodificada con el charset equivocado.
- Se validará antes de enviar que la factura esté emitida, que exista un destinatario válido, que exista el PDF y que SMTP esté configurado.
- Se agregarán pruebas unitarias para destinatario, adjuntos y errores de configuración. La entrega real solo puede verificarse con credenciales SMTP válidas del entorno.

### 5. Emisión desde Órdenes

- `issueInvoice` aceptará órdenes en estado `issued` o `paid`; rechazará borradores, vencidas, canceladas y ya facturadas.
- La tabla de órdenes mostrará `Emitir factura` para estados `issued` y `paid`, reutilizando la Server Action de facturación con autenticación, validación y revalidación de `/ordenes`, `/facturacion` y `/`.
- La orden conservará estado `issued`/`paid` mientras el DTE esté pendiente del SII. Solo una respuesta aceptada (`DOK` u otro estado explícitamente aceptado por `isSiiAcceptedStatus`) permitirá cambiarla a `invoiced`.
- La transición será idempotente y seguirá usando la factura única por orden y la clave `invoice:<orderId>`.
- La bandeja de facturación incluirá órdenes emitidas y pagadas sin factura para no ocultar órdenes disponibles, aunque el flujo principal quede en Órdenes.

## Fuera de alcance

- No se modificará el servicio externo IntellyDTE en este cambio.
- No se copiará el HTML/CSS ni la identidad exacta del PDF de Bevox.
- No se cambiará la firma, el XML fiscal original ni el significado de los estados del SII.
- No se implementará una cola de correo nueva; se mantendrá SMTP síncrono con mensajes y pruebas más claros.

## Verificación

- Pruebas TDD para la decodificación, descarga XML, renderer PDF, botón de regeneración, correo y emisión desde estados `issued`/`paid`.
- Render PNG de una factura corta y una factura con contenido largo para revisar clipping, wrapping, TED, totales y pies.
- `npm test`, `npm run typecheck`, `npm run lint` y `npm run build` antes de declarar el cambio terminado.
