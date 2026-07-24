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

