import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { ParsedDteDocument } from "./xml";
import { renderTedPdf417 } from "./xml";

const COLORS = {
  ink: [31, 41, 55] as [number, number, number],
  muted: [75, 85, 99] as [number, number, number],
  border: [203, 213, 225] as [number, number, number],
  pale: [248, 250, 252] as [number, number, number],
  blue: [31, 78, 121] as [number, number, number],
  red: [185, 28, 28] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

const money = (value: number) => `$${Math.round(value).toLocaleString("es-CL")}`;

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

function drawSectionHeader(pdf: jsPDF, title: FiscalPdfSection, x: number, y: number, width: number): number {
  pdf.setFillColor(...COLORS.blue);
  pdf.rect(x, y, width, 7, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(...COLORS.white);
  pdf.text(title, x + 3, y + 4.8);
  return y + 7;
}

function drawLabelValue(pdf: jsPDF, label: string, value: string, x: number, y: number, width: number, labelWidth: number): number {
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.1);
  pdf.setTextColor(...COLORS.ink);
  pdf.text(label, x, y);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...COLORS.muted);
  const lines = pdf.splitTextToSize(value, Math.max(20, width - labelWidth));
  pdf.text(lines, x + labelWidth, y);
  return Math.max(1, lines.length) * 3.5;
}

function drawKeyValue(pdf: jsPDF, label: string, value: string, x: number, y: number, width: number): void {
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.1);
  pdf.setTextColor(...COLORS.ink);
  pdf.text(label, x, y);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...COLORS.muted);
  pdf.text(pdf.splitTextToSize(value, width), x, y + 3.5);
}

function ensureSpace(pdf: jsPDF, y: number, required: number, margin: number, height: number): number {
  if (y + required <= height - margin) return y;
  pdf.addPage();
  return margin;
}

function drawPageNumbers(pdf: jsPDF, margin: number, height: number): void {
  const totalPages = pdf.getNumberOfPages();
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(6.5);
  pdf.setTextColor(...COLORS.muted);
  for (let page = 1; page <= totalPages; page += 1) {
    pdf.setPage(page);
    pdf.text(`Página ${page} de ${totalPages}`, pdf.internal.pageSize.getWidth() - margin, height - 6, { align: "right" });
  }
}

export async function renderFiscalPdf(document: ParsedDteDocument): Promise<Uint8Array> {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = width - margin * 2;
  const sections = buildFiscalPdfSections(document);

  const siiBoxWidth = 72;
  const siiBoxHeight = 32;
  const siiBoxX = width - margin - siiBoxWidth;
  const headerY = 13;
  const issuerWidth = siiBoxX - margin - 7;

  pdf.setDrawColor(...COLORS.red);
  pdf.setLineWidth(0.75);
  pdf.rect(siiBoxX, headerY, siiBoxWidth, siiBoxHeight);
  pdf.setTextColor(...COLORS.red);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.4);
  pdf.text(`R.U.T.: ${formatRutWithDots(document.issuer.rut)}`, siiBoxX + siiBoxWidth / 2, headerY + 7, { align: "center" });
  pdf.setFontSize(9.2);
  pdf.text("FACTURA ELECTRÓNICA", siiBoxX + siiBoxWidth / 2, headerY + 14.5, { align: "center" });
  pdf.setFontSize(12);
  pdf.text(`Nº ${document.folio}`, siiBoxX + siiBoxWidth / 2, headerY + 22, { align: "center" });
  pdf.setFontSize(7);
  pdf.text("S.I.I.", siiBoxX + siiBoxWidth / 2, headerY + 28, { align: "center" });

  pdf.setTextColor(...COLORS.ink);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  const issuerName = pdf.splitTextToSize(document.issuer.name, issuerWidth);
  pdf.text(issuerName, margin, headerY + 5);
  let issuerY = headerY + 5 + issuerName.length * 5;
  pdf.setFontSize(7.5);
  pdf.setFont("helvetica", "normal");
  const issuerLines = [
    `R.U.T.: ${formatRutWithDots(document.issuer.rut)}`,
    document.issuer.businessLine ? `Giro: ${document.issuer.businessLine}` : null,
    document.issuer.address ? `Dirección: ${document.issuer.address}` : null,
    document.issuer.commune || document.issuer.city ? `Comuna/Ciudad: ${[document.issuer.commune, document.issuer.city].filter(Boolean).join(", ")}` : null,
  ].filter((line): line is string => Boolean(line));
  for (const line of issuerLines) {
    const lines = pdf.splitTextToSize(line, issuerWidth);
    pdf.text(lines, margin, issuerY);
    issuerY += lines.length * 3.6;
  }

  let y = Math.max(headerY + siiBoxHeight + 6, issuerY + 4);

  y = drawSectionHeader(pdf, sections[0], margin, y, contentWidth);
  const receiverBoxY = y;
  const receiverBoxHeight = 38;
  pdf.setFillColor(...COLORS.pale);
  pdf.setDrawColor(...COLORS.border);
  pdf.setLineWidth(0.3);
  pdf.rect(margin, receiverBoxY, contentWidth, receiverBoxHeight, "FD");

  const receiverGap = 8;
  const receiverLeftWidth = 92;
  const receiverRightX = margin + receiverLeftWidth + receiverGap;
  drawLabelValue(pdf, "SEÑOR(ES):", textOrDash(document.receiver.name), margin + 3, receiverBoxY + 7, receiverLeftWidth - 5, 24);
  drawLabelValue(pdf, "R.U.T.:", formatRutWithDots(document.receiver.rut), margin + 3, receiverBoxY + 15, receiverLeftWidth - 5, 24);
  drawLabelValue(pdf, "GIRO:", textOrDash(document.receiver.businessLine), margin + 3, receiverBoxY + 23, receiverLeftWidth - 5, 24);
  drawLabelValue(pdf, "DIRECCIÓN:", [document.receiver.address, document.receiver.commune].filter(Boolean).join(", ") || "—", margin + 3, receiverBoxY + 31, receiverLeftWidth - 5, 24);
  drawKeyValue(pdf, "FECHA DE EMISIÓN", document.issueDate, receiverRightX, receiverBoxY + 7, contentWidth - receiverLeftWidth - receiverGap - 6);
  drawKeyValue(pdf, "FECHA DE VENCIMIENTO", document.dueDate || "Contado", receiverRightX, receiverBoxY + 16, contentWidth - receiverLeftWidth - receiverGap - 6);
  drawKeyValue(pdf, "COMUNA", textOrDash(document.receiver.commune), receiverRightX, receiverBoxY + 25, contentWidth - receiverLeftWidth - receiverGap - 6);
  drawKeyValue(pdf, "CIUDAD", textOrDash(document.receiver.city), receiverRightX, receiverBoxY + 34, contentWidth - receiverLeftWidth - receiverGap - 6);
  y = receiverBoxY + receiverBoxHeight + 6;

  y = drawSectionHeader(pdf, sections[1], margin, y, contentWidth);
  autoTable(pdf, {
    startY: y,
    margin: { left: margin, right: margin },
    rowPageBreak: "avoid",
    head: [["N°", "DESCRIPCIÓN", "CANT.", "UNIDAD", "P. UNITARIO", "DESCTO.", "TOTAL"]],
    body: document.details.map((item) => [
      String(item.lineNumber),
      item.description ? `${item.name}\n${item.description}` : item.name,
      String(item.quantity),
      item.unit || "—",
      money(item.unitPrice),
      item.discountAmount ? `-${money(item.discountAmount)}` : "—",
      money(item.amount),
    ]),
    styles: {
      font: "helvetica",
      fontSize: 7.4,
      cellPadding: 2.5,
      textColor: COLORS.ink,
      lineColor: COLORS.border,
      lineWidth: 0.2,
      valign: "middle",
    },
    headStyles: {
      fillColor: COLORS.blue,
      textColor: COLORS.white,
      fontStyle: "bold",
      halign: "center",
    },
    alternateRowStyles: { fillColor: COLORS.pale },
    columnStyles: {
      0: { cellWidth: 9, halign: "center" },
      1: { cellWidth: 64 },
      2: { cellWidth: 14, halign: "center" },
      3: { cellWidth: 17, halign: "center" },
      4: { cellWidth: 27, halign: "right" },
      5: { cellWidth: 25, halign: "right" },
      6: { cellWidth: 26, halign: "right", fontStyle: "bold" },
    },
  });
  y = (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 16;

  y = ensureSpace(pdf, y + 6, 28, margin, height);
  y = drawSectionHeader(pdf, sections[2], margin, y, contentWidth);
  const paymentY = y;
  const paymentHeight = 21;
  pdf.setFillColor(...COLORS.pale);
  pdf.setDrawColor(...COLORS.border);
  pdf.rect(margin, paymentY, contentWidth, paymentHeight, "FD");
  const paymentColumnWidth = contentWidth / 3;
  drawKeyValue(pdf, "CONDICIÓN DE PAGO", document.dueDate ? "Crédito" : "Contado", margin + 4, paymentY + 6, paymentColumnWidth - 8);
  drawKeyValue(pdf, "FECHA DE PAGO", document.dueDate || "No informado", margin + paymentColumnWidth + 4, paymentY + 6, paymentColumnWidth - 8);
  drawKeyValue(pdf, "MEDIO DE PAGO", "No informado", margin + paymentColumnWidth * 2 + 4, paymentY + 6, paymentColumnWidth - 8);
  y = paymentY + paymentHeight + 6;

  if (document.references.length) {
    y = ensureSpace(pdf, y, 20, margin, height);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...COLORS.ink);
    pdf.text("REFERENCIAS DOCUMENTARIAS", margin, y);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...COLORS.muted);
    const references = document.references.map((reference) => `${reference.type} / Folio ${reference.folio}${reference.reason ? ` · ${reference.reason}` : ""}`).join("\n");
    pdf.text(pdf.splitTextToSize(references, contentWidth), margin, y + 4);
    y += 12 + document.references.length * 3.5;
  }

  y = ensureSpace(pdf, y + 4, 63, margin, height);
  y = drawSectionHeader(pdf, sections[3], margin, y, contentWidth);
  const summaryY = y;
  const summaryHeight = 42;
  const totalsWidth = 72;
  const totalsX = width - margin - totalsWidth;
  pdf.setFillColor(...COLORS.pale);
  pdf.setDrawColor(...COLORS.border);
  pdf.rect(totalsX, summaryY, totalsWidth, summaryHeight, "FD");
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.6);
  pdf.setTextColor(...COLORS.muted);
  const totalLines: Array<[string, string]> = [
    ["Monto neto", money(document.totals.net)],
    ["Monto exento", money(document.totals.exempt)],
    [`I.V.A. (${document.totals.ivaRate}%)`, money(document.totals.iva)],
  ];
  const totalDiscount = document.details.reduce((sum, item) => sum + item.discountAmount, 0);
  if (totalDiscount > 0) totalLines.push(["Descuento", `-${money(totalDiscount)}`]);
  totalLines.forEach(([label, value], index) => {
    const lineY = summaryY + 7 + index * 6;
    pdf.text(label, totalsX + 4, lineY);
    pdf.text(value, totalsX + totalsWidth - 4, lineY, { align: "right" });
  });
  pdf.setFillColor(...COLORS.blue);
  pdf.rect(totalsX, summaryY + summaryHeight - 11, totalsWidth, 11, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.8);
  pdf.setTextColor(...COLORS.white);
  pdf.text("TOTAL", totalsX + 4, summaryY + summaryHeight - 4);
  pdf.text(money(document.totals.total), totalsX + totalsWidth - 4, summaryY + summaryHeight - 4, { align: "right" });

  const barcode = await renderTedPdf417(document.tedXml);
  const barcodeWidth = 88;
  const barcodeHeight = 27;
  pdf.addImage(barcode, "PNG", margin + 2, summaryY + 4, barcodeWidth, barcodeHeight);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  pdf.setTextColor(...COLORS.ink);
  pdf.text("Timbre Electrónico S.I.I.", margin + 2 + barcodeWidth / 2, summaryY + summaryHeight - 3, { align: "center" });
  if (document.resolution.number || document.resolution.date) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.3);
    pdf.setTextColor(...COLORS.muted);
    const resolution = `Res. N° ${document.resolution.number || "—"} de ${document.resolution.date || "—"} · Verifique documento en www.sii.cl`;
    pdf.text(pdf.splitTextToSize(resolution, 98), margin + 2, summaryY + summaryHeight + 4);
  }

  y = summaryY + summaryHeight + 10;
  y = ensureSpace(pdf, y, 20, margin, height);
  pdf.setDrawColor(...COLORS.border);
  pdf.line(margin, y, width - margin, y);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(6.8);
  pdf.setTextColor(...COLORS.muted);
  pdf.text("Acuse de recibo de mercaderías o servicios", margin, y + 5);
  pdf.text("Nombre, RUT y firma", width - margin, y + 5, { align: "right" });
  pdf.text("CEDIBLE", width - margin, y + 12, { align: "right" });

  drawPageNumbers(pdf, margin, height);
  return new Uint8Array(pdf.output("arraybuffer"));
}
