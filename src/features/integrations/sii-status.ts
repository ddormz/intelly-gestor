export function isSiiAcceptedStatus(status: string | null | undefined): boolean {
  return /^(?:DOK|ACCEPTED|ACEPTADO)$/.test(status?.trim().toUpperCase() ?? "");
}
