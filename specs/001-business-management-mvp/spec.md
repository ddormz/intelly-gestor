# Feature Specification: Intelly Gestor MVP

**Feature Branch**: `not-created`

**Created**: 2026-08-12

**Status**: Ready for planning

**Input**: User description: "Crear un sistema de gestión seguro para clientes, productos o
servicios, órdenes de pago, facturación e integraciones, con dashboard y emisión mediante
IntellyDTE."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Acceso seguro al sistema (Priority: P1)

Una persona autorizada inicia sesión y accede únicamente a las funciones permitidas para su perfil.

**Why this priority**: Todo dato comercial, personal y tributario debe permanecer inaccesible para
personas no autorizadas.

**Independent Test**: Se puede probar con credenciales válidas, inválidas, una cuenta bloqueada y
una sesión expirada, verificando acceso, rechazo y registro de los eventos correspondientes.

**Acceptance Scenarios**:

1. **Given** una cuenta activa, **When** la persona presenta credenciales válidas, **Then** accede al
   dashboard y se crea una sesión protegida.
2. **Given** credenciales inválidas repetidas, **When** se supera el límite permitido, **Then** los
   nuevos intentos se bloquean temporalmente sin revelar si la cuenta existe.
3. **Given** una sesión expirada o revocada, **When** se intenta abrir un módulo protegido, **Then**
   se solicita iniciar sesión nuevamente.
4. **Given** un operador sin permisos administrativos, **When** intenta gestionar usuarios o
   secretos de integración, **Then** el sistema rechaza la operación y registra el intento.

---

### User Story 2 - Mantener clientes y catálogo (Priority: P1)

Un usuario autorizado crea y mantiene clientes y productos o servicios reutilizables en las órdenes
de pago.

**Why this priority**: Clientes y conceptos cobrables son los datos mínimos para generar una orden.

**Independent Test**: Se puede crear un cliente y un servicio, editarlos, buscarlos y verificar que
no se acepten datos tributarios o precios inválidos.

**Acceptance Scenarios**:

1. **Given** datos válidos de un cliente, **When** se guardan, **Then** el cliente queda disponible
   para nuevas órdenes con su información de contacto y tributaria.
2. **Given** un producto o servicio con precio y tratamiento tributario válidos, **When** se guarda,
   **Then** queda disponible para agregarlo a una orden.
3. **Given** datos obligatorios incompletos o inconsistentes, **When** se intenta guardar, **Then**
   el sistema explica los campos que deben corregirse y no crea el registro.

---

### User Story 3 - Crear y enviar una orden de pago (Priority: P1)

Un usuario autorizado prepara una orden para un cliente, agrega conceptos, revisa totales y la emite
para compartir un enlace de pago o instrucciones de cobro.

**Why this priority**: La orden de pago es la operación comercial central del MVP.

**Independent Test**: Se puede crear una orden completa, emitirla una sola vez, abrir su vista pública
segura y registrar el cambio a pagada sin depender de la facturación.

**Acceptance Scenarios**:

1. **Given** un cliente activo y al menos un concepto válido, **When** se crea una orden, **Then** se
   calculan subtotal, descuentos, impuestos y total de forma visible antes de emitir.
2. **Given** una orden en borrador, **When** se emite, **Then** recibe un identificador único, queda
   inmutable en sus importes y genera un enlace difícil de adivinar que puede revocarse.
3. **Given** una orden emitida, **When** se registra el pago, **Then** queda la fecha, el importe, la
   referencia y el usuario o proceso que confirmó el pago.
4. **Given** la misma confirmación recibida más de una vez, **When** se procesa, **Then** el estado y
   los importes cambian una sola vez.

---

### User Story 4 - Emitir factura mediante IntellyDTE (Priority: P1)

Un usuario autorizado emite la factura de una orden pagada y puede consultar su resultado tributario.

**Why this priority**: Vincula el cobro con el objetivo de facturación del sistema.

**Independent Test**: Con una respuesta controlada del proveedor, se puede emitir una factura, guardar
su referencia, impedir duplicados y mostrar un error recuperable cuando el proveedor no responde.

**Acceptance Scenarios**:

1. **Given** una orden pagada y facturable, **When** se confirma la emisión, **Then** se envían los
   datos requeridos una vez y se conserva la referencia de IntellyDTE.
2. **Given** una factura ya emitida para la orden, **When** se repite la solicitud, **Then** el sistema
   muestra la factura existente y no genera un segundo documento.
3. **Given** una respuesta rechazada, incompleta o temporalmente indisponible, **When** se intenta
   emitir, **Then** el sistema conserva la orden, explica el estado y permite un reintento seguro.

---

### User Story 5 - Supervisar el negocio desde el dashboard (Priority: P2)

Un usuario visualiza indicadores y actividad reciente para conocer ventas, cobros y facturación.

**Why this priority**: Aporta control operativo una vez que el flujo comercial básico funciona.

**Independent Test**: Con un conjunto conocido de órdenes y facturas, los indicadores, tendencias y
listas recientes coinciden con los datos y respetan los filtros de período.

**Acceptance Scenarios**:

1. **Given** operaciones del período seleccionado, **When** se abre el dashboard, **Then** se muestran
   ingresos cobrados, monto pendiente, órdenes por estado y facturas emitidas.
2. **Given** datos de varios períodos, **When** se cambia el rango, **Then** todos los indicadores y
   tendencias se actualizan con el mismo criterio temporal.
3. **Given** que aún no existen operaciones, **When** se abre el dashboard, **Then** se muestra un
   estado vacío con acciones claras para crear cliente, concepto y orden.

---

### User Story 6 - Administrar integraciones y trazabilidad (Priority: P2)

Un administrador revisa el estado de las conexiones externas y el historial de operaciones críticas
sin ver secretos en texto plano.

**Why this priority**: Permite operar y diagnosticar el servicio sin comprometer credenciales.

**Independent Test**: Se puede verificar una conexión configurada, observar un estado degradado y
consultar eventos de auditoría con secretos siempre ocultos.

**Acceptance Scenarios**:

1. **Given** una integración configurada, **When** un administrador ejecuta una verificación, **Then**
   ve estado, fecha y un mensaje accionable sin exposición de secretos.
2. **Given** un fallo externo, **When** se consulta una orden o factura afectada, **Then** existe un
   identificador de correlación y un registro de los intentos seguros.

### Edge Cases

- Una orden no puede emitirse sin cliente activo, conceptos válidos ni total positivo.
- Los importes con redondeo tributario deben producir siempre el mismo total en orden y factura.
- Un cliente o concepto usado históricamente no puede eliminarse de manera que invalide documentos;
  se desactiva para uso futuro.
- Cambios concurrentes sobre la misma orden deben detectar el conflicto y evitar perder información.
- La caída de la base de datos o de IntellyDTE debe producir un error recuperable, sin confirmar una
  operación cuyo resultado sea desconocido.
- Un enlace público vencido, revocado o alterado no debe revelar datos de la orden.
- Una factura rechazada conserva el detalle del rechazo y puede reintentarse sin duplicación.
- Las estadísticas deben considerar anulaciones y fechas de negocio de manera consistente.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST autenticar cuentas internas mediante correo y contraseña, sin registro
  público, y permitir a administradores activar, desactivar y revocar sesiones de cuentas.
- **FR-002**: El sistema MUST almacenar contraseñas de forma no reversible y MUST aplicar bloqueo
  temporal progresivo, mensajes no enumerables y registro de intentos de acceso.
- **FR-003**: El sistema MUST proteger todas las funciones internas por sesión y autorización de rol,
  con perfiles iniciales de administrador y operador.
- **FR-004**: El sistema MUST finalizar sesiones por inactividad y expiración absoluta, y MUST impedir
  reutilizar una sesión revocada.
- **FR-005**: El sistema MUST permitir crear, consultar, buscar, actualizar y desactivar clientes con
  datos comerciales, de contacto, dirección y tributarios validados.
- **FR-006**: El sistema MUST permitir crear, consultar, buscar, actualizar y desactivar productos o
  servicios con código, descripción, precio, moneda y tratamiento tributario.
- **FR-007**: El sistema MUST permitir crear órdenes de pago en borrador con cliente, conceptos,
  cantidades, precios, descuentos, impuestos, vencimiento, notas y moneda.
- **FR-008**: El sistema MUST calcular y mostrar subtotales, descuentos, impuestos y total con reglas
  consistentes y precisión apropiada para dinero.
- **FR-009**: El sistema MUST controlar los estados de una orden como borrador, emitida, pagada,
  vencida, cancelada y facturada, rechazando transiciones inválidas.
- **FR-010**: El sistema MUST generar para cada orden emitida un acceso compartible, revocable,
  expirable y resistente a enumeración, mostrando sólo los datos necesarios para el cobro.
- **FR-011**: El sistema MUST registrar pagos con importe, fecha, método y referencia, y procesar cada
  confirmación externa o manual de forma idempotente.
- **FR-012**: El sistema MUST emitir mediante IntellyDTE una factura asociada a una orden pagada,
  conservar identificadores, estado, marcas de tiempo y respuesta normalizada, e impedir duplicados.
- **FR-013**: El sistema MUST permitir reintentos seguros ante fallos temporales de IntellyDTE y MUST
  diferenciar claramente estados pendiente, procesando, emitida y rechazada.
- **FR-014**: El sistema MUST mostrar un dashboard con ingresos cobrados, monto pendiente, órdenes por
  estado, facturas emitidas, tendencias temporales y actividad reciente filtrables por período.
- **FR-015**: El sistema MUST presentar una navegación lateral adaptable con Dashboard, Productos o
  Servicios, Clientes, Órdenes de Pago, Facturación e Integraciones.
- **FR-016**: El sistema MUST mostrar estados de carga, vacío, éxito y error accesibles en cada módulo,
  y MUST pedir confirmación explícita para acciones financieras destructivas o irreversibles.
- **FR-017**: El sistema MUST permitir a administradores verificar el estado de las conexiones de
  persistencia e IntellyDTE sin mostrar secretos.
- **FR-018**: El sistema MUST mantener un historial inmutable de inicios de sesión, cambios de estado,
  emisión, reintentos y acciones administrativas, con actor, fecha e identificador de correlación.
- **FR-019**: El sistema MUST exportar o imprimir una representación legible de órdenes y facturas sin
  exponer datos internos ni credenciales.
- **FR-020**: El sistema MUST validar datos y autorización en el servidor incluso cuando la interfaz
  ya haya realizado validaciones previas.

### Key Entities *(include if feature involves data)*

- **Usuario**: Cuenta interna, rol, estado de acceso, historial de credenciales y sesiones.
- **Sesión**: Acceso revocable asociado a un usuario, con creación, actividad, expiración y contexto
  de seguridad.
- **Cliente**: Persona o empresa destinataria del cobro, con contacto, dirección y datos tributarios.
- **Producto o Servicio**: Concepto reutilizable, código, descripción, precio y tratamiento tributario.
- **Orden de Pago**: Solicitud de cobro con cliente, líneas congeladas, totales, vencimiento y estado.
- **Línea de Orden**: Instantánea de descripción, cantidad, precio, descuento e impuesto al emitir.
- **Pago**: Confirmación idempotente asociada a una orden, con importe, método, fecha y referencia.
- **Factura**: Documento tributario asociado a una orden, estado e identificadores de IntellyDTE.
- **Intento de Integración**: Ejecución trazable hacia un proveedor, con resultado normalizado y datos
  sensibles redactados.
- **Evento de Auditoría**: Registro inmutable de una acción crítica y su actor o proceso de origen.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de las rutas internas rechaza solicitudes sin sesión válida y las operaciones
  administrativas rechazan perfiles no autorizados en pruebas de aceptación.
- **SC-002**: Un operador capacitado puede crear cliente, concepto y orden emitida en menos de 4
  minutos sin asistencia.
- **SC-003**: El 100% de los reintentos duplicados usados en las pruebas genera como máximo una orden,
  un pago y una factura por intención de negocio.
- **SC-004**: El 95% de las vistas internas muestra información útil o un estado accionable en menos
  de 2 segundos bajo la carga objetivo inicial de 25 usuarios simultáneos.
- **SC-005**: Los indicadores del dashboard coinciden exactamente con un conjunto de datos financiero
  conocido para todos los períodos y estados probados.
- **SC-006**: Al menos 9 de 10 usuarios de prueba completan el flujo de crear y emitir una orden en el
  primer intento.
- **SC-007**: Las tareas críticas de login, navegación, creación de orden y emisión de factura pueden
  completarse sólo con teclado y no presentan fallos críticos de accesibilidad automatizada.
- **SC-008**: Ninguna pantalla, exportación, registro ni mensaje de error expone contraseñas, secretos
  de integración o cadenas de conexión durante las pruebas de seguridad.

## Assumptions

- El MVP es una aplicación web interna para una sola organización, con roles Administrador y Operador.
- Las cuentas son creadas por un administrador; auto-registro, SSO y recuperación automática de
  contraseña quedan fuera del primer alcance.
- La moneda inicial es CLP y el tratamiento de IVA es configurable por concepto; múltiples monedas y
  conversiones quedan fuera del MVP aunque cada registro conserva su moneda.
- Un pago puede registrarse manualmente; la integración con una pasarela de pago específica queda
  fuera de alcance hasta que se defina el proveedor.
- Hostinger proveerá una base MySQL accesible mediante conexión cifrada y un usuario de privilegios
  mínimos; las credenciales se entregarán fuera del repositorio.
- IntellyDTE proveerá credenciales, ambiente de pruebas y contrato vigente para emisión; hasta entonces
  la integración se validará con respuestas controladas y su verificación real quedará pendiente.
- La entrega de órdenes o facturas por correo no forma parte del MVP; el usuario puede copiar un enlace
  seguro o descargar una representación legible.
- Notas de crédito, anulaciones tributarias, inventario físico, conciliación bancaria y contabilidad
  general quedan fuera del MVP inicial.
