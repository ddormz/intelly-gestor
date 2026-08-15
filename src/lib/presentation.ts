const statusLabels: Record<string, string> = {
  active: "Activo",
  cancelled: "Cancelada",
  draft: "Borrador",
  expired: "Vencida",
  failed: "Fallida",
  invoiced: "Facturada",
  issued: "Emitida",
  paid: "Pagada",
  pending: "Pendiente",
  processing: "Procesando",
  rejected: "Rechazada",
  success: "Exitosa",
};

const operationLabels: Record<string, string> = {
  issue_invoice: "Emisión de factura",
  get_status: "Consulta de estado",
  lookup_rut: "Consulta de RUT",
  sync_emission: "Emisión sincrónica",
  async_emission: "Emisión asincrónica",
  webhook_event: "Notificación webhook",
  test_connection: "Prueba de conexión",
  health_check: "Verificación de salud",
  smtp_test: "Prueba de correo SMTP",
  webpay_create: "Creación de pago WebPay",
  webpay_commit: "Confirmación de pago WebPay",
};

export function getStatusLabel(status: string): string {
  return statusLabels[status] ?? status.charAt(0).toUpperCase() + status.slice(1);
}

export function getOperationLabel(operation: string): string {
  return operationLabels[operation] ?? operation.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
