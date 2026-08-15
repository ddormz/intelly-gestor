function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!);
}

export function orderEmail(input: { name: string; number: string; publicUrl: string }) {
  const subject = `Tu orden de pago ${input.number}`;
  const text = `Hola ${input.name},\n\nPuedes revisar tu orden de pago ${input.number} en este enlace seguro:\n${input.publicUrl}\n\nAdjuntamos la orden comercial en PDF.`;
  const html = `<div style="font-family:Inter,Arial,sans-serif;color:#0a1733;line-height:1.6"><h1 style="color:#0f2a6b">Orden de pago ${escapeHtml(input.number)}</h1><p>Hola ${escapeHtml(input.name)},</p><p>Adjuntamos tu orden comercial en PDF.</p><p><a href="${escapeHtml(input.publicUrl)}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#1b4be0;color:white;text-decoration:none;font-weight:700">Revisar orden segura</a></p><p style="color:#64748b;font-size:13px">El enlace es privado y puede vencer.</p></div>`;
  return { subject, text, html };
}
