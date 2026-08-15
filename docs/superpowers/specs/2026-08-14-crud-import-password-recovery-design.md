# Intelly Gestor: CRUD, CSV y recuperación de contraseña

**Fecha:** 2026-08-14

**Estado:** Aprobado para planificación técnica

**Alcance:** Segunda iteración funcional y de experiencia sobre el branding Intelly ya publicado.

## Objetivo

Separar las operaciones de mantenimiento de los listados, completar los CRUD administrativos de forma segura, incorporar intercambio CSV controlado y ofrecer recuperación de contraseña por correo mediante SMTP de Hostinger. La solución conserva Server Components, Server Actions, las rutas financieras existentes y el diseño del PDF de órdenes de pago.

## Decisiones de arquitectura

- Mantener Server Components para lectura y Server Actions para mutaciones.
- Introducir componentes cliente únicamente donde exista interacción local: modal, selector de archivo, sidebar colapsable y retroalimentación de formularios.
- Usar un modal compartido basado en el elemento nativo `dialog`, con foco contenido y etiquetas accesibles. No se cerrará al pulsar el fondo. Podrá cerrarse mediante el botón `X`, Cancelar o `Escape`, salvo mientras exista un envío pendiente.
- Aplicar validación de esquema en el servidor, protección same-origin, autorización por rol y auditoría a todas las nuevas mutaciones.
- Las bajas de clientes, productos y usuarios serán lógicas mediante su estado. No se eliminarán registros relacionados.

## Navegación y shell

- El sidebar de escritorio tendrá dos estados: expandido de 260 px y colapsado de 76 px.
- Al colapsarse conservará isotipo, iconos y tooltips accesibles. La preferencia se persistirá en `localStorage` después de la hidratación para evitar diferencias entre servidor y cliente.
- En móvil continuará como drawer temporal.
- `Usuarios` será un módulo independiente en `/usuarios`; `/integraciones/usuarios` redirigirá a la nueva ruta para conservar compatibilidad.
- El enlace de Usuarios será visible sólo para administradores.
- El botón de cierre de sesión será compacto y se eliminará la insignia “Operación segura”.

## Modales y formularios

- Los encabezados de Clientes, Productos/Servicios, Órdenes, Usuarios e Integraciones tendrán botones que abran las operaciones correspondientes.
- Crear, editar, desactivar, importar, configurar credenciales y confirmar operaciones sensibles se resolverán en modales.
- Todos los campos tendrán placeholder, ejemplo o texto de ayuda útil. Los selectores incluirán opciones descriptivas.
- Los errores de campo se mostrarán junto al control y los mensajes generales usarán `aria-live`.
- Los botones se deshabilitarán durante el envío para evitar duplicados.
- Los listados dejarán de compartir columnas de layout con formularios persistentes.

## CRUD por módulo

### Clientes

- Crear y editar información comercial y tributaria.
- Desactivar sin borrar relaciones históricas.
- Los clientes inactivos permanecerán visibles con su estado y no podrán seleccionarse en nuevas órdenes.

### Productos o Servicios

- Crear y editar código, nombre, descripción, precio y tratamiento tributario.
- Desactivar sin alterar las líneas históricas copiadas a órdenes.
- Los conceptos inactivos permanecerán visibles y no podrán seleccionarse en nuevas órdenes.

### Órdenes de Pago

- Crear borradores desde un modal.
- Mantener emisión y registro de pago como transiciones protegidas e idempotentes.
- Las transiciones sensibles usarán confirmación modal, sin cambiar el cálculo financiero ni el PDF.

### Facturación

- Mantener emisión mediante IntellyDTE como operación transaccional.
- Usar confirmación modal para emitir una factura.
- Conservar estados, contratos, idempotencia y trazabilidad existentes.

### Usuarios

- Crear, editar nombre y rol, y desactivar cuentas.
- Impedir que un administrador se desactive a sí mismo.
- Revocar todas las sesiones al desactivar una cuenta o restablecer su contraseña.
- Mantener correo como identificador único.

## Importación y exportación CSV

- Los CSV serán UTF-8 con BOM para compatibilidad con Excel y encabezados documentados en español estable.
- Cada módulo de datos incluirá Exportar, Importar y Descargar plantilla cuando corresponda.
- El archivo completo se analizará y validará antes de iniciar una transacción. Cualquier fila inválida cancelará la importación completa y devolverá errores con número de fila.
- Se aplicará un límite de tamaño y cantidad de filas para proteger memoria y base de datos.
- Clientes se identificarán por RUT cuando exista y, de lo contrario, por correo; Catálogo por código; Usuarios por correo.
- Clientes, Catálogo y Usuarios podrán crear registros nuevos y actualizar registros coincidentes sin reactivar automáticamente registros desactivados.
- Órdenes sólo aceptarán nuevos borradores. Cada fila usará RUT del cliente, código de catálogo y cantidad; no se sobrescribirán órdenes existentes.
- Facturación sólo aceptará documentos históricos ya emitidos, con número de orden pagada, folio e identificador externo obligatorios. No llamará a IntellyDTE y no sobrescribirá documentos existentes.
- Integraciones sólo permitirá exportar su historial; importar intentos externos está prohibido para preservar trazabilidad.
- Las exportaciones respetarán permisos y no incluirán hashes, credenciales, tokens, claves ni metadatos sensibles.

## Configuración de IntellyDTE

- Integraciones ofrecerá un modal de configuración para `Base URL` y `API Key`.
- La API Key se cifrará en el servidor con AES-256-GCM usando una clave maestra provista por `CREDENTIALS_ENCRYPTION_KEY`.
- La base de datos almacenará ciphertext, IV y etiqueta de autenticación; la interfaz sólo recibirá un indicador de configuración y una versión enmascarada.
- Guardar una configuración nueva reemplazará la credencial activa y generará auditoría sin incluir el secreto.
- La configuración podrá probar la conectividad mediante una operación segura de IntellyDTE. Un fallo de prueba se mostrará sin filtrar datos sensibles.
- Las variables de entorno actuales podrán actuar como compatibilidad transitoria de lectura, pero la configuración guardada en el módulo tendrá precedencia.

## Recuperación de contraseña por correo

- Login incluirá un enlace a `/recuperar-contrasena`.
- El usuario enviará su correo y siempre recibirá una respuesta neutra, exista o no la cuenta.
- Para cuentas activas se generará un token criptográficamente aleatorio. La base de datos almacenará únicamente SHA-256 del token, usuario, expiración, fecha de uso y fecha de creación.
- El token expirará a los 30 minutos, será de un solo uso y la creación de uno nuevo invalidará los anteriores del mismo usuario.
- Se aplicará limitación temporal por correo e IP para reducir abuso sin revelar existencia de cuentas.
- El enlace usará `APP_URL` y llevará a `/restablecer-contrasena?token=...`.
- La nueva contraseña tendrá entre 12 y 128 caracteres y deberá confirmarse.
- Tras el cambio se marcará el token como usado, se actualizará `passwordChangedAt`, se reiniciarán bloqueo e intentos fallidos, se revocarán todas las sesiones y se escribirá auditoría.
- El correo se enviará mediante SMTP de Hostinger con conexión TLS y las variables `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` y `SMTP_FROM`.
- Los errores SMTP no expondrán credenciales. La pantalla conservará la respuesta neutra.

## Cambios de datos

- Crear una tabla para configuraciones de integración cifradas.
- Crear una tabla para tokens de recuperación de contraseña con índices por hash, usuario y expiración.
- No modificar las tablas financieras ni regenerar el formato del PDF.
- Las migraciones se ejecutarán mediante el bootstrap de producción ya existente.

## Seguridad y errores

- Mantener Argon2id para contraseñas y los controles de sesión existentes.
- Mantener same-origin en Server Actions y requerir administrador para Usuarios, importaciones administrativas y configuración de Integraciones.
- Sanitizar nombres de archivo y contenido CSV; no interpretar fórmulas al exportar valores que comiencen con `=`, `+`, `-` o `@`.
- No registrar valores de API Key, contraseña SMTP ni tokens de recuperación.
- Usar mensajes seguros para errores esperables y correlación interna para errores inesperados.

## Pruebas y aceptación

- Pruebas unitarias para cifrado autenticado, tokens de recuperación, expiración, uso único, serialización CSV, prevención de fórmulas, validación por filas y reglas de importación financiera.
- Pruebas de acciones para autorización, revocación de sesiones, edición/desactivación e invalidación atómica de importaciones.
- Pruebas de componentes para modal no descartable por clic exterior, placeholders, sidebar colapsado y navegación por rol.
- Verificar manualmente SMTP con una cuenta de prueba de Hostinger sin incluir credenciales en fixtures.
- Ejecutar lint, TypeScript, pruebas unitarias, pruebas heredadas y build de producción.
- Validar teclado, foco, `Escape`, lectores de pantalla, responsive y objetivos táctiles.
- Se considera terminado cuando todos los formularios de mantenimiento estén en modales, los CRUD acordados funcionen, los CSV respeten sus restricciones, IntellyDTE se configure de forma cifrada y el flujo de recuperación complete el cambio y cierre las sesiones previas.

## Variables de entorno nuevas

```text
APP_URL=https://gestion.intelly.cl
CREDENTIALS_ENCRYPTION_KEY=<32 bytes aleatorios codificados en base64>
SMTP_HOST=<host SMTP indicado por Hostinger>
SMTP_PORT=465
SMTP_USER=<casilla de envío>
SMTP_PASSWORD=<contraseña de la casilla>
SMTP_FROM=Intelly Gestor <no-reply@intelly.cl>
```

`SMTP_PORT=587` podrá utilizarse cuando la cuenta de Hostinger requiera STARTTLS en vez de TLS implícito.
