export function isSiiAcceptedStatus(status: string | null | undefined): boolean {
  return /^(?:DOK|ACCEPTED|ACEPTADO)$/.test(status?.trim().toUpperCase() ?? "");
}

export function isSiiRejectedStatus(status: string | null | undefined): boolean {
  return /^(?:RPR|DNK|FAN|RCT|REJECTED|RECHAZADO)$|REJECT|RECHAZ/.test(status?.trim().toUpperCase() ?? "");
}
