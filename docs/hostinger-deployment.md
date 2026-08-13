# Despliegue de producción en Hostinger

Esta aplicación se despliega desde el repositorio privado `ddormz/intelly-gestor`, rama `main`. La fuente de verdad es GitHub: no se deben editar archivos de la aplicación directamente en el servidor.

## Configuración inicial

En Hostinger, conecta el repositorio privado y configura el proyecto como **Next.js** con estas opciones:

| Ajuste | Valor |
| --- | --- |
| Repositorio | `ddormz/intelly-gestor` (privado) |
| Rama de producción | `main` |
| Versión de Node.js | Node.js 22.x |
| Instalación | `npm ci` cuando Hostinger permita definir el comando; en caso contrario, usar la instalación basada en el lockfile de Hostinger |
| Build | `npm run build` |
| Inicio | `npm run start` |
| Dominio | `gestion.intelly.cl` con HTTPS activo |

Después de asociar el dominio, comprobar que `https://gestion.intelly.cl` carga sin advertencias de certificado y que crear, guardar, exportar e importar una orden funciona en un navegador de prueba.

## Publicación normal

1. Revisar y fusionar el cambio aprobado en `main`.
2. Hacer `git push` de `main` a GitHub.
3. Esperar que Hostinger instale dependencias, ejecute `npm run build` e inicie con `npm run start`.
4. Verificar la URL HTTPS y las funciones principales antes de anunciar el despliegue.

## Respaldo y migración de datos

La aplicación conserva ajustes, historial y correlativos en el navegador. Antes de cambiar de equipo, navegador o perfil, exportar un respaldo local desde la interfaz y conservar el JSON fuera de Git.

Para migrar datos, exportar localmente, abrir la aplicación online e importar el archivo. La importación sustituye los datos de ese navegador; antes de confirmarla, validar el conteo de órdenes y el próximo correlativo para evitar duplicados o saltos. Los respaldos `respaldo-ordenes-intelly-*.json` no se deben adjuntar a incidencias ni almacenar en el repositorio.

## Variables de entorno y futuro DTE

Actualmente no hay variables de entorno requeridas en producción. Si se añade integración DTE, las credenciales y certificados se configuran exclusivamente como variables de entorno de Hostinger. Nunca usar prefijos `NEXT_PUBLIC_*`, Git, almacenamiento del navegador, capturas de pantalla ni mensajes de soporte para guardar o compartir secretos. Documentar solo los nombres de las variables necesarias, no sus valores.

## Rollback

Si un despliegue falla, revertir en `main` el commit que introdujo el problema, hacer push y redeplegar desde la última fuente conocida como correcta. No hacer cambios manuales en producción: el commit de reversión debe quedar registrado en GitHub. Tras el redeploy, comprobar la aplicación en `https://gestion.intelly.cl`.
