# Regeneración tributaria e ítems libres en órdenes

## Contexto

Facturación ya materializa el XML firmado y el PDF tributario local al emitir una factura. Se necesita regenerar el PDF de la última factura emitida y dejar la capacidad disponible para futuras facturas. Además, el estado visual debe usar exactamente la etiqueta accesible `Aceptado por SII`, y las órdenes deben permitir líneas ad hoc que no pertenezcan al catálogo.

## Objetivos

1. Regenerar de forma segura el PDF tributario de una factura emitida usando su XML firmado, conservando folio y datos fiscales.
2. Exponer regeneración manual para cualquier factura emitida, aunque ya exista un PDF.
3. Mostrar el estado aceptado como `Aceptado por SII`, únicamente mediante el ícono junto al folio.
4. Permitir agregar a una orden un ítem libre, solo para esa orden, con descripción editable, cantidad inicial 1, precio inicial 0 y tasa afecta de 19%.
5. Mantener validación, cálculo, auditoría y compatibilidad con órdenes/conceptos existentes.

## No objetivos

- No crear ni modificar productos o servicios del catálogo.
- No cambiar folios, XML firmados, estado SII ni datos tributarios de una factura durante una regeneración.
- No permitir que una línea libre con total cero se emita como factura: la regla actual de total positivo se conserva.
- No agregar una tabla nueva ni cambiar el esquema de base de datos; `payment_order_lines.catalog_item_id` ya admite `NULL`.

## Diseño

### Regeneración de PDF tributario

Se agregará un servicio de regeneración que:

1. Verifica que la factura exista y esté emitida.
2. Obtiene el XML firmado almacenado y lo vuelve a parsear/validar.
3. Renderiza el PDF fiscal local desde el documento tributario parseado.
4. Guarda el PDF como una nueva versión de evidencia, actualiza el vínculo de la factura y marca `evidenceStatus = complete`.
5. Limpia los errores de evidencia y registra una auditoría `invoice.pdf_reconstructed`.

Si no existe XML firmado, la acción intentará conciliar el estado con IntellyDTE para obtenerlo. Si la reconstrucción falla, conservará la factura emitida, marcará `evidenceStatus = failed` y entregará un mensaje seguro para reintento.

La acción estará disponible en las acciones de cada factura emitida y podrá invocarse para la última factura emitida. El folio, XML, identificador de proveedor y datos SII no se modificarán.

### Estado junto al folio

El ícono de estado permanecerá en la celda de folio, sin columna visible `Estado`. Para una factura aceptada, el `title` y `aria-label` serán exactamente `Aceptado por SII`. La información seguirá siendo accesible sin añadir texto visible.

### Ítem libre por orden

La línea del carrito se extenderá para aceptar `catalogItemId = null` y una descripción enviada por el usuario. La UI tendrá un botón `Agregar ítem libre` que agregará una fila con:

- descripción vacía, obligatoria antes de guardar;
- cantidad 1;
- precio unitario 0;
- tasa 19%;
- categoría afecta;
- clave visual local única para permitir varias líneas libres.

Las líneas del catálogo seguirán resolviéndose desde el servidor y sus nombres/precios/tasas no se confiarán desde el navegador. Para una línea libre, el servidor validará la descripción, ignorará cualquier tasa enviada por el cliente y aplicará 19% afecto. La línea se persistirá con `catalogItemId = NULL`, código nulo y la descripción capturada.

La edición de órdenes conservará líneas libres existentes y permitirá cambiar descripción, cantidad y precio. Las comparaciones de versión, rotación del token público, descuentos y cálculos se mantendrán activos.

### Flujo de datos

```text
Factura emitida
  -> acción de regenerar
  -> XML firmado almacenado
  -> parseo/validación DTE 33
  -> render PDF fiscal
  -> nueva versión de evidencia
  -> vínculo de factura + auditoría

Orden
  -> catálogo o ítem libre
  -> payload de carrito
  -> validación servidor
  -> cálculo IVA/totales
  -> payment_order_lines (catalog_item_id nullable)
```

## Manejo de errores

- Descripción libre vacía: error de validación de la línea.
- Carrito sin líneas: se conserva el error actual.
- Orden con total cero: se puede guardar como borrador, pero no se puede emitir.
- XML ausente, inválido o inconsistente: error seguro y evidencia fallida/pending según corresponda.
- PDF inválido o fallo de almacenamiento: factura emitida, evidencia fallida y reintento disponible.
- Conflicto de versión al editar: se conserva el control optimista actual.

## Pruebas

- Regeneración crea una nueva versión de PDF, conserva folio/XML y limpia errores.
- Regeneración fallida deja la factura emitida con evidencia fallida.
- Estado aceptado contiene exactamente `Aceptado por SII` y no agrega columna visible.
- Payload de ítem libre conserva descripción/cantidad/precio y no serializa datos no autorizados.
- Validación rechaza línea libre sin descripción y acepta precio 0 con tasa afecta.
- Creación y actualización persisten líneas libres con `catalogItemId = null` y recalculan IVA/totales.
- Órdenes de catálogo existentes mantienen su comportamiento.

## Verificación operativa

Después de implementar se ejecutarán las pruebas unitarias completas, typecheck, lint y build. La regeneración de la última factura se ejecutará solo si el entorno tiene una base de datos/configuración disponible; de lo contrario se dejará el mecanismo listo y se reportará la limitación sin mutar datos.
