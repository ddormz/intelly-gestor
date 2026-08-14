# Diseño: bootstrap durante el build administrado de Hostinger

**Fecha:** 2026-08-14

## Problema

Hostinger detecta Next.js y arranca su servidor directamente, omitiendo el script `npm start` del
repositorio. La aplicación alcanza MySQL, pero el esquema queda vacío porque el bootstrap de
arranque nunca se ejecuta. El panel tampoco permite definir un comando personalizado.

## Diseño aprobado

Se añadirá un lifecycle `prebuild` estándar de npm. Cuando `DATABASE_URL` esté presente, este
ejecutará el mismo bootstrap bloqueado e idempotente que ya usa producción: obtiene `GET_LOCK`,
aplica migraciones Drizzle y crea el administrador únicamente cuando
`BOOTSTRAP_ADMIN_ENABLED=true`. Después npm continuará con `next build`.

El bootstrap se extraerá a una función compartida para que `prebuild` y `npm start` conserven el
mismo comportamiento. Sin `DATABASE_URL` y sin bootstrap de administrador habilitado, `prebuild`
se omitirá para mantener funcionales los builds locales y de CI sin MySQL. Si se solicita crear el
administrador sin `DATABASE_URL`, el build fallará de forma explícita.

## Seguridad y operación

- No se registrarán URLs, contraseñas, hashes ni tokens.
- Las migraciones y la creación del administrador continuarán protegidas por el bloqueo MySQL.
- Los redeploys serán idempotentes; un administrador activo existente no será modificado.
- Tras el primer acceso se retirarán `ADMIN_*` y se establecerá
  `BOOTSTRAP_ADMIN_ENABLED=false`; las migraciones seguirán ejecutándose porque `DATABASE_URL`
  permanece configurada.

## Verificación

- Una prueba de proceso ejecutará `prebuild` sin base configurada y comprobará que termina bien.
- La configuración de despliegue comprobará que npm invoca el script antes de `next build`.
- La suite completa y un build limpio sin dependencias de desarrollo deben pasar.
