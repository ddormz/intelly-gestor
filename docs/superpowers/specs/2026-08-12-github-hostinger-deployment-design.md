# Publicación en GitHub y Hostinger

## Objetivo

Publicar el Generador de Órdenes de Pago Intelly desde un repositorio privado de
GitHub en un plan compartido de Hostinger con soporte para aplicaciones Node.js.
La migración debe conservar todas las funciones actuales y dejar una base segura
para incorporar facturación mediante Intelly DTE en una etapa posterior.

## Alcance

Esta etapa incluye:

- Migrar la configuración de ejecución desde Vinext/Cloudflare a Next.js estándar.
- Publicar el proyecto en el repositorio privado `ddormz/intelly-gestor` de GitHub.
- Preparar la aplicación para Node.js 22 en Hostinger.
- Incorporar exportación e importación de un respaldo JSON local.
- Documentar compilación, ejecución y despliegue.
- Conectar el repositorio privado a Hostinger y validar la aplicación publicada.

Esta etapa no incluye emisión de DTE, autenticación, base de datos ni sincronización
entre dispositivos.

## Arquitectura

La aplicación continuará siendo una interfaz Next.js que genera los PDF en el
navegador. Los ajustes, correlativos e historial seguirán almacenados en
`localStorage`. Se reemplazará la configuración específica de Cloudflare por la
configuración estándar de Next.js para que Hostinger pueda detectar, compilar y
ejecutar el proyecto como una aplicación Node.js.

La aplicación usará:

- Node.js 22.
- `npm ci` para instalar dependencias reproducibles.
- `npm run build` para generar la compilación de producción.
- `npm run start` para iniciar el servidor Next.js.
- La rama `main` como fuente de producción.

No se introducirán servicios de servidor que no sean necesarios para la versión
actual.

## Repositorio y despliegue

El código se almacenará en el repositorio privado
`https://github.com/ddormz/intelly-gestor.git`. Los artefactos generados,
dependencias, respaldos y archivos temporales permanecerán excluidos mediante
`.gitignore`.

Hostinger se conectará al repositorio privado mediante su integración oficial de
GitHub. El proyecto se desplegará como una aplicación Next.js de servidor. Los
nuevos cambios en `main` podrán iniciar despliegues automáticos. Hostinger
administrará el proceso Node y el enrutamiento del dominio.

El repositorio no contendrá credenciales. Las futuras claves, certificados y
configuraciones de Intelly DTE se almacenarán como variables privadas en
Hostinger.

## Respaldo y restauración

La aplicación ofrecerá una exportación JSON con:

- Versión del formato de respaldo.
- Fecha de creación.
- Configuración comercial y bancaria.
- Órdenes guardadas.
- Estado de correlativos.

La importación aceptará únicamente archivos con una estructura y versión válidas.
Antes de restaurar, mostrará un resumen con la cantidad de órdenes y solicitará
confirmación. La restauración reemplazará los datos locales del dominio actual,
evitando mezclar historiales o producir correlativos inconsistentes. Tras una
importación válida, la interfaz se actualizará con los datos restaurados.

El respaldo no incluirá credenciales de GitHub, Hostinger ni Intelly DTE. Como
`localStorage` está separado por dominio, el flujo de migración será:

1. Exportar el respaldo desde la aplicación local.
2. Abrir la aplicación publicada.
3. Importar el archivo.
4. Confirmar que ajustes, historial y correlativo fueron restaurados.

## Preparación para Intelly DTE

La integración tributaria posterior se implementará exclusivamente del lado del
servidor. El navegador llamará una API autenticada de la aplicación; esa API se
conectará a Intelly DTE usando secretos de Hostinger y registrará el resultado en
una base de datos. Ninguna clave tributaria o certificado será enviado al cliente
ni guardado en `localStorage`.

La migración actual conservará una separación clara entre los componentes de
interfaz y las futuras rutas del servidor, pero no agregará código DTE prematuro.

## Errores y seguridad

- Un archivo de respaldo inválido será rechazado sin modificar los datos actuales.
- La restauración requerirá confirmación explícita porque reemplaza datos locales.
- Los secretos y archivos `.env` estarán ignorados por Git.
- El despliegue utilizará dependencias fijadas mediante `package-lock.json`.
- Una compilación fallida no debe sustituir una versión de producción funcional.

## Validación

Antes de publicar se comprobará:

- Compilación y arranque con Next.js estándar en Node.js 22.
- Pruebas existentes de la interfaz y comportamiento.
- Generación de PDF con y sin descuento y sin páginas vacías adicionales.
- Exportación de un respaldo válido.
- Rechazo de archivos inválidos.
- Restauración de configuración, órdenes y correlativos.
- Persistencia después de recargar el navegador.
- Ausencia de secretos y artefactos generados en Git.
- Acceso a la aplicación mediante HTTPS en `gestion.intelly.cl`.

## Criterios de aceptación

El trabajo estará completo cuando el repositorio privado exista, el código esté
publicado en `main`, Hostinger ejecute la aplicación correctamente y una copia de
los datos locales pueda trasladarse al dominio mediante el respaldo JSON. La
generación de órdenes y PDF deberá conservar el comportamiento validado antes de
la migración.
