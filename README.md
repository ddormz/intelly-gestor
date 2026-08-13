# Intelly Gestor

MVP web para administrar clientes, productos o servicios, órdenes de pago y facturas emitidas a
través de un adaptador IntellyDTE. El proyecto nació con Spec Kit y conserva la especificación,
arquitectura, contratos y tareas en `specs/001-business-management-mvp/`.

## Estado actual

- Login interno con Argon2id, bloqueo temporal, sesión opaca revocable y autorización por rol.
- MySQL con esquema Drizzle de 12 tablas, migraciones y pool reutilizable.
- Sidebar responsive y módulos Dashboard, Productos o Servicios, Clientes, Órdenes de Pago,
  Facturación e Integraciones.
- Flujo base cliente → catálogo → orden → emisión → pago → factura.
- IntellyDTE funciona en modo `fake` determinista. El modo HTTP falla de forma segura hasta recibir
  el contrato oficial, credenciales y ambiente sandbox.

## Desarrollo local

1. Copia `.env.example` como `.env.local`.
2. Inicia MySQL con `docker compose up -d mysql`.
3. Instala dependencias con `npm install` (o `npm ci` cuando el lockfile ya esté actualizado).
4. Aplica el esquema con `npm run db:migrate`.
5. Crea el administrador sin escribir su contraseña en archivos:

   ```powershell
   $env:ADMIN_EMAIL='admin@empresa.cl'
   $env:ADMIN_NAME='Administrador'
   $env:ADMIN_PASSWORD='una-frase-larga-y-unica'
   npm run db:seed-admin
   ```

6. Ejecuta `npm run dev` y abre `http://localhost:3000`.

## Variables de producción

Configura `DATABASE_URL`, `APP_ORIGIN`, `SESSION_COOKIE_NAME` e IntellyDTE en el panel del runtime;
no subas archivos `.env`. En producción `APP_ORIGIN` debe ser el origen HTTPS exacto.

### MySQL de Hostinger

phpMyAdmin es la herramienta de administración; la aplicación se conecta directamente al servidor
MySQL. Crea una base y un usuario de privilegios mínimos en hPanel. Si la app corre fuera de
Hostinger, agrega únicamente la IP fija de salida en **Remote MySQL**; evita “Any Host”. Usa el host y
puerto 3306 informados por hPanel, confirma soporte TLS/CA para tu plan, realiza un respaldo y luego
ejecuta `npm run db:migrate` desde el entorno de despliegue.

Documentación: [Hostinger: Node.js con MySQL](https://www.hostinger.com/support/connecting-a-hostinger-mysql-database-to-a-node-js-application/)
y [Hostinger: acceso MySQL remoto](https://support.hostinger.com/en/articles/1583546-how-to-set-up-remote-mysql-access-in-hostinger).

### IntellyDTE

Antes de cambiar `INTELLYDTE_MODE=http`, se necesitan URL sandbox, autenticación, RUT emisor, esquema
de emisión, consulta de estado, garantías de idempotencia y ejemplos de aceptación/rechazo. El
contrato interno y la lista de pruebas están en
`specs/001-business-management-mvp/contracts/intellydte-adapter.md`. No se han inventado endpoints ni
cargas del proveedor.

## Verificación

```text
npm run lint
npm run typecheck
npm test
npm run build
```

Las pruebas de integración requieren MySQL local. Las pruebas de navegador requieren una base migrada
y una cuenta de prueba, y nunca deben apuntar a producción.

## Punto de partida conservado

El generador original basado en `localStorage` fue reemplazado por el flujo persistente del gestor.
Sus utilidades de PDF, respaldo, recursos gráficos, pruebas y guía histórica de despliegue permanecen
en `lib/`, `public/`, `tests/` y `docs/` para facilitar la migración gradual y evitar perder trabajo.
