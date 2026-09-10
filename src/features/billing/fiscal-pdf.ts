import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { ParsedDteDocument } from "./xml";
import { renderTedPdf417 } from "./xml";

const COLORS = {
  ink: [30, 41, 59] as [number, number, number],
  muted: [71, 85, 105] as [number, number, number],
  border: [203, 213, 225] as [number, number, number],
  pale: [248, 250, 252] as [number, number, number],
  blue: [27, 75, 224] as [number, number, number],      // Intelly Brand Royal Blue (#1b4be0)
  cyan: [20, 208, 246] as [number, number, number],     // Intelly Brand Cyan (#14d0f6)
  red: [204, 0, 0] as [number, number, number],         // Official SII Red (#cc0000)
  white: [255, 255, 255] as [number, number, number],
  lightBlue: [238, 245, 255] as [number, number, number],
};

const money = (value: number) => `$${Math.round(value).toLocaleString("es-CL")}`;
const formatNumber = (value: number) => Math.round(value).toLocaleString("es-CL");

export type FiscalPdfSection =
  | "INFORMACIÓN DEL RECEPTOR"
  | "DETALLE DEL DOCUMENTO"
  | "INFORMACIÓN DE PAGOS"
  | "RESUMEN DEL DOCUMENTO";

export function buildFiscalPdfSections(_document: ParsedDteDocument): FiscalPdfSection[] {
  return [
    "INFORMACIÓN DEL RECEPTOR",
    "DETALLE DEL DOCUMENTO",
    "INFORMACIÓN DE PAGOS",
    "RESUMEN DEL DOCUMENTO",
  ];
}

function formatRutWithDots(raw: string): string {
  if (!raw) return "";
  const clean = raw.replace(/[^0-9kK]/g, "").toUpperCase();
  if (clean.length < 2) return raw;
  const dv = clean.slice(-1);
  const body = clean.slice(0, -1);
  const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${formattedBody}-${dv}`;
}

function textOrDash(value: string | null | undefined): string {
  return value?.trim() || "—";
}

function getTipoDteLabel(type: string): string {
  switch (type) {
    case "33":
      return "FACTURA ELECTRÓNICA";
    case "34":
      return "FACTURA NO AFECTA O EXENTA ELECTRÓNICA";
    case "39":
      return "BOLETA ELECTRÓNICA";
    case "41":
      return "BOLETA EXENTA ELECTRÓNICA";
    case "56":
      return "NOTA DE DÉBITO ELECTRÓNICA";
    case "61":
      return "NOTA DE CRÉDITO ELECTRÓNICA";
    default:
      return "FACTURA ELECTRÓNICA";
  }
}

function formatDate(rawDate: string): string {
  if (!rawDate) return "";
  const clean = rawDate.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}:\d{2}:\d{2}))?/.exec(clean);
  if (match) {
    const [, yyyy, mm, dd, time] = match;
    return time ? `${dd}/${mm}/${yyyy} ${time}` : `${dd}/${mm}/${yyyy}`;
  }
  return clean;
}

function drawSectionHeader(pdf: jsPDF, title: FiscalPdfSection, x: number, y: number, width: number): number {
  pdf.setFillColor(...COLORS.blue);
  pdf.rect(x, y, width, 6, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.8);
  pdf.setTextColor(...COLORS.white);
  pdf.text(title, x + 3, y + 4.2);
  return y + 6;
}

export type FiscalPdfOptions = {
  logoDataUrl?: string;
};

async function loadDefaultLogo(): Promise<string> {
  try {
    const logoBuffer = await readFile(resolve(process.cwd(), "public", "intelly-logo.png"));
    return `data:image/png;base64,${logoBuffer.toString("base64")}`;
  } catch {
    return "";
  }
}

function renderDocumentCopy(
  pdf: jsPDF,
  document: ParsedDteDocument,
  barcodeDataUrl: string,
  logoDataUrl: string
): void {
  const width = pdf.internal.pageSize.getWidth();
  const margin = 12;
  const contentWidth = width - margin * 2;
  const sections = buildFiscalPdfSections(document);

  const headerY = 10;
  const siiBoxWidth = 74;
  const siiBoxHeight = 31;
  const siiBoxX = width - margin - siiBoxWidth;

  // 1. Logo (Top Left)
  if (logoDataUrl) {
    try {
      pdf.addImage(logoDataUrl, "PNG", margin, headerY, 34, 18);
    } catch {
      // Ignored if image format unsupported
    }
  }

  // 2. Issuer Info (Top Left, below or alongside logo)
  const issuerStartY = logoDataUrl ? headerY + 20 : headerY + 2;
  const issuerWidth = siiBoxX - margin - 6;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10.5);
  pdf.setTextColor(...COLORS.blue);
  const issuerName = pdf.splitTextToSize(document.issuer.name.toUpperCase(), issuerWidth);
  pdf.text(issuerName, margin, issuerStartY);
  let issuerCurrentY = issuerStartY + issuerName.length * 4.2;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(...COLORS.muted);

  const issuerFields: Array<[string, string | null | undefined]> = [
    ["Giro", document.issuer.businessLine],
    ["Dirección", document.issuer.address],
    ["Comuna", document.issuer.commune],
    ["Ciudad", document.issuer.city],
  ];

  for (const [label, val] of issuerFields) {
    if (val?.trim()) {
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...COLORS.ink);
      pdf.text(`${label}:`, margin, issuerCurrentY);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(...COLORS.muted);
      const lines = pdf.splitTextToSize(val.trim(), issuerWidth - 16);
      pdf.text(lines, margin + 16, issuerCurrentY);
      issuerCurrentY += lines.length * 3.3;
    }
  }

  // 3. Official SII Red Box (Top Right)
  pdf.setDrawColor(...COLORS.red);
  pdf.setLineWidth(0.85);
  pdf.rect(siiBoxX, headerY, siiBoxWidth, siiBoxHeight);

  pdf.setTextColor(...COLORS.red);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9.5);
  pdf.text(`R.U.T.: ${formatRutWithDots(document.issuer.rut)}`, siiBoxX + siiBoxWidth / 2, headerY + 7, { align: "center" });

  pdf.setFontSize(10.2);
  pdf.text(getTipoDteLabel(document.type), siiBoxX + siiBoxWidth / 2, headerY + 15, { align: "center" });

  pdf.setFontSize(14.5);
  pdf.text(`Nº ${document.folio}`, siiBoxX + siiBoxWidth / 2, headerY + 24, { align: "center" });

  // Subtext below red box
  const rawCommune = (document.issuer.commune || "").trim().toUpperCase();
  const rawCity = (document.issuer.city || "").trim().toUpperCase();
  let unidadCity = "LAMPA";
  if (rawCommune && !rawCommune.includes("METROPOLITANA") && !rawCommune.includes("SANTIAGO")) {
    unidadCity = rawCommune;
  } else if (rawCity && !rawCity.includes("METROPOLITANA") && !rawCity.includes("SANTIAGO")) {
    unidadCity = rawCity;
  } else if (rawCommune) {
    unidadCity = rawCommune;
  }
  pdf.setTextColor(...COLORS.blue);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.text(`S.I.I. - ${unidadCity}`, siiBoxX + siiBoxWidth / 2, headerY + siiBoxHeight + 4.5, { align: "center" });

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.text(`Fecha de Emisión: ${formatDate(document.issueDate)}`, siiBoxX + siiBoxWidth / 2, headerY + siiBoxHeight + 8.5, { align: "center" });

  // 4. Section: INFORMACIÓN DEL RECEPTOR
  let y = Math.max(headerY + siiBoxHeight + 12, issuerCurrentY + 4);
  y = drawSectionHeader(pdf, sections[0], margin, y, contentWidth);

  const receiverBoxY = y;
  const receiverBoxHeight = 22;
  pdf.setFillColor(...COLORS.pale);
  pdf.setDrawColor(...COLORS.border);
  pdf.setLineWidth(0.2);
  pdf.rect(margin, receiverBoxY, contentWidth, receiverBoxHeight, "FD");

  const col1X = margin + 3;
  const col2X = margin + 96;

  const drawField = (label: string, value: string, x: number, fieldY: number, maxW: number) => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.2);
    pdf.setTextColor(...COLORS.ink);
    pdf.text(label, x, fieldY);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...COLORS.muted);
    pdf.text(pdf.splitTextToSize(value, maxW), x + 20, fieldY);
  };

  drawField("Razón Social", textOrDash(document.receiver.name), col1X, receiverBoxY + 5.5, 70);
  drawField("RUT", formatRutWithDots(document.receiver.rut), col1X, receiverBoxY + 11.5, 70);
  drawField("Giro", textOrDash(document.receiver.businessLine), col1X, receiverBoxY + 17.5, 70);

  drawField("Dirección", textOrDash(document.receiver.address), col2X, receiverBoxY + 5.5, 68);
  drawField("Comuna", textOrDash(document.receiver.commune), col2X, receiverBoxY + 11.5, 68);
  drawField("Ciudad", textOrDash(document.receiver.city), col2X, receiverBoxY + 17.5, 68);

  y = receiverBoxY + receiverBoxHeight + 4;

  // 5. Section: DETALLE DEL DOCUMENTO
  y = drawSectionHeader(pdf, sections[1], margin, y, contentWidth);

  autoTable(pdf, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    rowPageBreak: "avoid",
    head: [["Código", "Nombre", "Descripción", "Cantidad", "Precio Neto", "Dcto.", "Total"]],
    body: document.details.map((item) => {
      const hasSeparateDescription = Boolean(item.description && item.description.trim() !== item.name.trim());
      const code = hasSeparateDescription && item.description!.length <= 20
        ? item.description!
        : `ITM-${item.lineNumber}`;
      const name = item.name;
      const description = hasSeparateDescription ? item.description! : "-";
      return [
        code,
        name,
        description,
        String(item.quantity),
        money(item.unitPrice),
        item.discountAmount ? money(item.discountAmount) : "0",
        money(item.amount),
      ];
    }),
    styles: {
      font: "helvetica",
      fontSize: 7,
      cellPadding: 2,
      textColor: COLORS.ink,
      lineColor: COLORS.border,
      lineWidth: 0.15,
      valign: "middle",
    },
    headStyles: {
      fillColor: COLORS.blue,
      textColor: COLORS.white,
      fontStyle: "bold",
      halign: "center",
      fontSize: 7.2,
    },
    alternateRowStyles: { fillColor: COLORS.pale },
    columnStyles: {
      0: { cellWidth: 18, halign: "left" },
      1: { cellWidth: 40, halign: "left" },
      2: { cellWidth: 60, halign: "left" },
      3: { cellWidth: 14, halign: "center" },
      4: { cellWidth: 20, halign: "right" },
      5: { cellWidth: 14, halign: "right" },
      6: { cellWidth: 20, halign: "right", fontStyle: "bold" },
    },
  });

  y = (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20;
  y += 4;

  // 6. Section: INFORMACIÓN DE PAGOS
  y = drawSectionHeader(pdf, sections[2], margin, y, contentWidth);

  const paymentBoxY = y;
  const paymentBoxHeight = 12;
  pdf.setFillColor(...COLORS.pale);
  pdf.setDrawColor(...COLORS.border);
  pdf.setLineWidth(0.2);
  pdf.rect(margin, paymentBoxY, contentWidth, paymentBoxHeight, "FD");

  const payCols = [
    { label: "Fecha", val: formatDate(document.issueDate) },
    { label: "Monto", val: money(document.totals.total) },
    { label: "Medio de pago", val: document.dueDate ? "Crédito" : "Transferencia" },
    { label: "Glosa", val: document.dueDate ? `Vencimiento: ${formatDate(document.dueDate)}` : "Pago al contado" },
  ];

  const payColWidth = contentWidth / 4;
  payCols.forEach((col, idx) => {
    const colX = margin + idx * payColWidth + 2;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6.8);
    pdf.setTextColor(...COLORS.ink);
    pdf.text(col.label, colX, paymentBoxY + 4.5);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...COLORS.muted);
    pdf.text(col.val, colX, paymentBoxY + 9);
  });

  y = paymentBoxY + paymentBoxHeight + 5;

  // 7. References (if any)
  if (document.references.length) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.2);
    pdf.setTextColor(...COLORS.ink);
    pdf.text("REFERENCIAS DOCUMENTARIAS", margin, y);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...COLORS.muted);
    const references = document.references
      .map((ref) => `${ref.type} / Folio ${ref.folio}${ref.reason ? ` · ${ref.reason}` : ""}`)
      .join("\n");
    pdf.text(pdf.splitTextToSize(references, contentWidth), margin, y + 3.5);
    y += 8 + document.references.length * 3;
  }

  // 8. Timbre + RESUMEN DEL DOCUMENTO
  const summaryWidth = 76;
  const summaryX = width - margin - summaryWidth;
  const summaryY = y;
  const summaryHeight = 36;

  // Right Box: RESUMEN DEL DOCUMENTO
  pdf.setFillColor(...COLORS.pale);
  pdf.setDrawColor(...COLORS.border);
  pdf.setLineWidth(0.2);
  pdf.rect(summaryX, summaryY, summaryWidth, summaryHeight, "FD");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...COLORS.blue);
  pdf.text("RESUMEN DEL DOCUMENTO", summaryX + summaryWidth / 2, summaryY + 5, { align: "center" });

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.3);
  pdf.setTextColor(...COLORS.ink);

  const summaryLines: Array<[string, string]> = [
    ["Monto Neto", formatNumber(document.totals.net)],
  ];
  if (document.totals.exempt > 0) {
    summaryLines.push(["Monto Exento", formatNumber(document.totals.exempt)]);
  }
  summaryLines.push([`I.V.A. ${document.totals.ivaRate || 19}%`, formatNumber(document.totals.iva)]);

  const totalDiscount = document.details.reduce((sum, item) => sum + item.discountAmount, 0);
  if (totalDiscount > 0) {
    summaryLines.push(["Descuento", `-${formatNumber(totalDiscount)}`]);
  }

  summaryLines.forEach(([lbl, val], idx) => {
    const lineY = summaryY + 11 + idx * 4.8;
    pdf.text(lbl, summaryX + 4, lineY);
    pdf.text("$", summaryX + summaryWidth - 28, lineY);
    pdf.text(val, summaryX + summaryWidth - 4, lineY, { align: "right" });
  });

  // Total bar
  pdf.setFillColor(...COLORS.blue);
  pdf.rect(summaryX, summaryY + summaryHeight - 8.5, summaryWidth, 8.5, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.setTextColor(...COLORS.white);
  pdf.text("Total", summaryX + 4, summaryY + summaryHeight - 3);
  pdf.text("$", summaryX + summaryWidth - 28, summaryY + summaryHeight - 3);
  pdf.text(formatNumber(document.totals.total), summaryX + summaryWidth - 4, summaryY + summaryHeight - 3, { align: "right" });

  // Left side: TED / Timbre
  if (barcodeDataUrl) {
    const barcodeWidth = 84;
    const barcodeHeight = 25;
    try {
      pdf.addImage(barcodeDataUrl, "PNG", margin + 2, summaryY, barcodeWidth, barcodeHeight);
    } catch {
      // Barcode image fallback
    }

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.2);
    pdf.setTextColor(...COLORS.ink);
    pdf.text("Timbre electrónico S.I.I.", margin + 2 + barcodeWidth / 2, summaryY + barcodeHeight + 4.5, { align: "center" });

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.2);
    pdf.setTextColor(...COLORS.muted);
    const resNumber = document.resolution.number || "80";
    const resDate = document.resolution.date || "2014-08-22";
    pdf.text(`Res.${resNumber} de ${resDate}. Verifique el documento en: www.sii.cl`, margin + 2 + barcodeWidth / 2, summaryY + barcodeHeight + 8, { align: "center" });
  }
}

export async function renderFiscalPdf(
  document: ParsedDteDocument,
  options?: FiscalPdfOptions
): Promise<Uint8Array> {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });

  const logoDataUrl = options?.logoDataUrl ?? (await loadDefaultLogo());
  let barcodeDataUrl = "";
  try {
    barcodeDataUrl = await renderTedPdf417(document.tedXml);
  } catch {
    barcodeDataUrl = "";
  }

  // Documento oficial tributario (1 sola página)
  renderDocumentCopy(pdf, document, barcodeDataUrl, logoDataUrl);

  return new Uint8Array(pdf.output("arraybuffer"));
}

