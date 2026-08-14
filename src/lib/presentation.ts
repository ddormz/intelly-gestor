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
  rejected: "Rechazada",
  success: "Exitosa",
};

export function getStatusLabel(status: string): string {
  return statusLabels[status] ?? status.charAt(0).toUpperCase() + status.slice(1);
}
