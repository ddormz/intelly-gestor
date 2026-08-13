# Generador de Órdenes de Pago Intelly

Aplicación web privada para crear, guardar y descargar órdenes de pago en PDF
con el branding de Intelly.

## Funcionalidades

- Plantilla de Hosting y modalidad de servicio libre.
- Cálculo automático de subtotal, IVA 19% y total.
- Órdenes con o sin factura.
- Configuración local de empresa, cuenta bancaria y condiciones comerciales.
- Correlativo anual e historial almacenado en el navegador.
- PDF A4 con paginación automática.
- Diseño responsive para escritorio y móvil.

Los datos se guardan exclusivamente en `localStorage`; la aplicación no utiliza
servidor ni base de datos.

## Desarrollo

```bash
npm ci
npm run dev
npm test
npm run pdf:sample
```

Los PDFs de validación se generan en `output/pdf/`.

## Respaldo y recuperación

Los datos operativos viven en el `localStorage` de cada navegador. Desde **Respaldo local**, usa **Exportar respaldo** para descargar un archivo `respaldo-ordenes-intelly-AAAA-MM-DD.json` que contiene los ajustes, correlativos e historial. Guárdalo en una ubicación segura fuera del repositorio.

Para recuperar o migrar los datos a otro navegador, abre la aplicación y usa **Importar respaldo**. La importación reemplaza los datos locales existentes: confirma antes el número de órdenes y el próximo correlativo. Los archivos de respaldo están ignorados por Git y nunca deben subirse al repositorio.

La configuración de producción, la migración entre navegadores y el rollback están en la [guía de despliegue de Hostinger](docs/hostinger-deployment.md).
