function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character]!
  );
}

export function invoiceEmail(input: {
  name: string;
  folio: number;
  total?: string;
  pdfUrl?: string;
}) {
  const subject = `Factura Electrónica N° ${input.folio} · Intelly`;
  const text = `Hola ${input.name},\n\nAdjuntamos tu Factura Electrónica N° ${input.folio} (DTE 33) emitida por Intelly SpA.\n\nSaludos cordiales,\nEquipo Intelly`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Factura Electrónica N° ${escapeHtml(String(input.folio))}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0a1733;line-height:1.6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f6fb;padding:30px 15px;">
    <tr>
      <td align="center">
        <!-- Main Email Container -->
        <table role="presentation" width="100%" style="max-width:580px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 12px rgba(10,23,51,0.05);">
          <!-- Brand Header -->
          <tr>
            <td style="background:linear-gradient(135deg, #0a1733 0%, #0f2a6b 100%);padding:32px 36px 28px;text-align:left;border-bottom:3px solid #14d0f6;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size:22px;font-weight:900;letter-spacing:-0.5px;color:#ffffff;text-transform:uppercase;">
                      INTELLY<span style="color:#14d0f6;">.</span>
                    </div>
                    <div style="font-size:11px;font-weight:700;color:#14d0f6;text-transform:uppercase;letter-spacing:1.5px;margin-top:4px;">
                      Facturación Electrónica DTE
                    </div>
                  </td>
                  <td align="right">
                    <span style="display:inline-block;padding:6px 12px;background:rgba(20,208,246,0.15);border:1px solid rgba(20,208,246,0.4);border-radius:20px;color:#14d0f6;font-size:11px;font-weight:700;font-family:monospace;">
                      Folio N° ${escapeHtml(String(input.folio))}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding:36px 36px 24px;">
              <h1 style="margin:0 0 16px;font-size:20px;font-weight:800;color:#0a1733;">
                Hola ${escapeHtml(input.name)},
              </h1>
              <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
                Adjuntamos tu <strong>Factura Electrónica N° ${escapeHtml(String(input.folio))}</strong> oficial emitida conforme a la normativa del Servicio de Impuestos Internos (SII).
              </p>

              <!-- Summary Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;margin:24px 0;">
                <tr>
                  <td style="padding:20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Tipo de Documento</td>
                        <td align="right" style="font-size:13px;font-weight:700;color:#0a1733;">Factura Electrónica (DTE 33)</td>
                      </tr>
                      <tr>
                        <td style="padding-top:10px;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Folio SII</td>
                        <td align="right" style="padding-top:10px;font-size:14px;font-weight:700;color:#0a1733;font-family:monospace;">${escapeHtml(String(input.folio))}</td>
                      </tr>
                      <tr>
                        <td style="padding-top:10px;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Receptor</td>
                        <td align="right" style="padding-top:10px;font-size:13px;font-weight:600;color:#0a1733;">${escapeHtml(input.name)}</td>
                      </tr>
                      ${
                        input.total
                          ? `<tr>
                        <td style="padding-top:12px;font-size:13px;color:#0a1733;font-weight:800;border-top:1px dashed #cbd5e1;">Monto Total</td>
                        <td align="right" style="padding-top:12px;font-size:18px;font-weight:900;color:#1b4be0;font-family:monospace;border-top:1px dashed #cbd5e1;">${escapeHtml(input.total)}</td>
                      </tr>`
                          : ""
                      }
                    </table>
                  </td>
                </tr>
              </table>

              ${
                input.pdfUrl
                  ? `<div style="text-align:center;margin:32px 0 24px;">
                <a href="${escapeHtml(input.pdfUrl)}" style="display:inline-block;padding:14px 32px;background:#1b4be0;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;border-radius:10px;box-shadow:0 4px 10px rgba(27,75,224,0.3);text-align:center;">
                  Descargar Factura en PDF
                </a>
              </div>`
                  : ""
              }

              <p style="margin:24px 0 0;font-size:12px;color:#64748b;line-height:1.5;text-align:center;">
                📄 El archivo PDF oficial con Timbre Electrónico DTE (TED) y el XML firmado están adjuntos a este correo.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;padding:24px 36px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.4;">
                Documento tributario emitido por <strong>Intelly SpA</strong> a través del sistema <strong>Intelly Gestor</strong>.<br>
                Timbre Electrónico SII conforme a Resolución Exenta N° 80.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}
