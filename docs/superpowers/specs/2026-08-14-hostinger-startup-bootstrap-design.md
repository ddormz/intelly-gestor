# Diseño: bootstrap seguro de Hostinger sin acceso a terminal

**Fecha:** 2026-08-14  
**Estado:** aprobado conceptualmente; pendiente de revisión del documento

## Objetivo

Permitir que Intelly Gestor prepare su base MySQL y cree el primer administrador durante el arranque
en Hostinger, sin ejecutar comandos manuales y sin mantener una vía permanente de creación de
administradores.

## Restricciones

- El operador puede configurar variables de entorno y solicitar un redeploy desde hPanel.
- El operador no dispone de una terminal en el entorno de producción.
- Las credenciales no se almacenarán en Git, logs, respuestas HTTP ni tablas distintas de `users`.
- El proceso debe ser seguro frente a reinicios, despliegues repetidos e instancias concurrentes.
- La aplicación no debe iniciar si el esquema requerido no puede quedar actualizado.

## Enfoque elegido

El comando de inicio ejecutará un orquestador de bootstrap antes de iniciar Next.js. Este proceso
aplicará las migraciones pendientes en todos los arranques. La creación del primer administrador
solo estará habilitada cuando `BOOTSTRAP_ADMIN_ENABLED=true`.

No se añadirá una ruta web de configuración. Así se evita exponer una operación privilegiada a
Internet y no es necesario administrar un segundo token de acceso temporal.

## Variables

Variables permanentes:

- `DATABASE_URL`: conexión MySQL usada por migraciones y runtime.
- `DB_POOL_LIMIT`: límite de conexiones de la aplicación.

Variables temporales para el primer arranque:

- `BOOTSTRAP_ADMIN_ENABLED`: debe ser exactamente `true` para permitir el alta inicial.
- `ADMIN_EMAIL`: correo normalizado a minúsculas.
- `ADMIN_NAME`: nombre del administrador; usa `Administrador` si se omite.
- `ADMIN_PASSWORD`: contraseña de 12 a 128 caracteres, cifrada con la configuración Argon2id
  existente.

Cuando `BOOTSTRAP_ADMIN_ENABLED` no sea `true`, el arranque no leerá ni utilizará las variables
`ADMIN_*`.

## Flujo de arranque

1. El script abre una conexión MySQL dedicada.
2. Obtiene `GET_LOCK('intelly-gestor-bootstrap', 30)` y exige un resultado exitoso.
3. Aplica las migraciones Drizzle pendientes desde `src/db/migrations`.
4. Si el bootstrap de administrador está deshabilitado, libera recursos y continúa.
5. Si está habilitado, valida correo, nombre y contraseña antes de consultar o modificar `users`.
6. Busca el correo normalizado:
   - Si no existe, crea un usuario `admin` activo con hash Argon2id.
   - Si existe y ya es administrador activo, no modifica credenciales y continúa.
   - Si existe con otro rol o estado, detiene el arranque para evitar elevar privilegios
     accidentalmente.
7. Libera el bloqueo y cierra la conexión incluso ante errores.
8. Solo después de un bootstrap correcto inicia `next start` y conserva las señales/exit code del
   proceso de Next.js.

## Idempotencia y concurrencia

Las migraciones de Drizzle registran el historial aplicado. El bloqueo asesor serializa el
bootstrap cuando Hostinger levanta más de una instancia. La restricción única de `users.email`
continúa siendo la última defensa contra duplicados.

Repetir un despliegue con el mismo administrador no cambia su contraseña. Esto permite confirmar
un primer arranque exitoso antes de retirar las variables temporales.

## Errores y observabilidad

Los logs indicarán únicamente etapas y resultados seguros: migraciones aplicadas, administrador
creado, administrador ya existente o bootstrap deshabilitado. Nunca imprimirán la URL completa de
la base, contraseñas, hashes ni tokens.

El proceso terminará con código distinto de cero si no puede conectar, obtener el bloqueo, migrar,
validar variables o resolver de forma segura un usuario existente. Next.js no iniciará en esos
casos para evitar operar con un esquema incompleto.

## Cambios previstos

- Extraer migración y creación del administrador a funciones reutilizables y testeables.
- Añadir un orquestador de arranque y un script `start:production`.
- Configurar `start` para ejecutar el orquestador sin cambiar el comando esperado por Hostinger.
- Incorporar `BOOTSTRAP_ADMIN_ENABLED` al esquema de variables y `.env.example`.
- Hacer que `/api/health` compruebe MySQL y responda de forma segura, sin incluir credenciales ni
  detalles internos del error.
- Actualizar la guía de Hostinger con el procedimiento de activación, comprobación y retirada de
  secretos.

## Pruebas

- Bootstrap deshabilitado: migra y no intenta crear usuarios.
- Variables temporales incompletas o contraseña inválida: falla antes de escribir.
- Usuario inexistente: crea exactamente un administrador con hash verificable.
- Administrador activo existente: no cambia el hash ni crea duplicados.
- Correo existente con rol/estado incompatible: falla sin elevar privilegios.
- Error de migración o bloqueo: no inicia Next.js y libera recursos.
- Ejecuciones repetidas: resultado idempotente.
- Build productivo con `npm ci --omit=dev` y suite existente completa.

## Operación en Hostinger

Para el primer despliegue, el operador configura las variables temporales y redepliega. Tras
confirmar que `/api/health` informa que MySQL está disponible y que el login funciona, establece
`BOOTSTRAP_ADMIN_ENABLED=false`, elimina `ADMIN_EMAIL`, `ADMIN_NAME` y `ADMIN_PASSWORD`, y vuelve a
desplegar. Los despliegues futuros siguen aplicando migraciones automáticamente, sin crear usuarios.

## Fuera de alcance

- Página pública o privada de instalación.
- Recuperación de contraseñas.
- Creación automática de administradores adicionales.
- Rotación automática de credenciales MySQL o IntellyDTE.
