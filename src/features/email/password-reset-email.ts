export function passwordResetEmail(input: { name: string; resetUrl: string; expiresMinutes: number }) {
  const subject = "Restablece tu contraseña de Intelly Gestor";
  const text = `Hola ${input.name},\n\nRecibimos una solicitud para restablecer tu contraseña. Abre este enlace dentro de ${input.expiresMinutes} minutos:\n${input.resetUrl}\n\nSi no solicitaste el cambio, ignora este mensaje.`;
  const html = `<div style="font-family:Inter,Arial,sans-serif;color:#0a1733;line-height:1.6"><h1 style="color:#0f2a6b">Restablece tu contraseña</h1><p>Hola ${escapeHtml(input.name)},</p><p>Recibimos una solicitud para restablecer tu contraseña de Intelly Gestor.</p><p><a href="${escapeHtml(input.resetUrl)}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#1b4be0;color:white;text-decoration:none;font-weight:700">Crear nueva contraseña</a></p><p>El enlace vence en ${input.expiresMinutes} minutos y sólo puede utilizarse una vez.</p><p style="color:#64748b;font-size:13px">Si no solicitaste el cambio, ignora este mensaje.</p></div>`;
  return { subject, text, html };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!);
}
