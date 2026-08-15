import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { ParsedDteDocument } from "./xml";
import { renderTedPdf417 } from "./xml";

const money = (value: number) => `$${Math.round(value).toLocaleString("es-CL")}`;

function formatRutWithDots(raw: string): string {
  if (!raw) return "";
  const clean = raw.replace(/[^0-9kK]/g, "").toUpperCase();
  if (clean.length < 2) return raw;
  const dv = clean.slice(-1);
  const body = clean.slice(0, -1);
  const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${formattedBody}-${dv}`;
}

export async function renderFiscalPdf(document: ParsedDteDocument): Promise<Uint8Array> {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const margin = 14;

  // 1. Top Right: Official SII Red Box
  const boxWidth = 76;
  const boxHeight = 28;
  const boxX = width - margin - boxWidth;
  const boxY = 12;

  pdf.setDrawColor(220, 38, 38); // Official SII Red
  pdf.setLineWidth(0.8);
  pdf.rect(boxX, boxY, boxWidth, boxHeight);

  pdf.setTextColor(220, 38, 38);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10.5);
  pdf.text(`R.U.T.: ${formatRutWithDots(document.issuer.rut)}`, boxX + boxWidth / 2, boxY + 7, { align: "center" });

  pdf.setFontSize(10);
  pdf.text("FACTURA ELECTRÓNICA", boxX + boxWidth / 2, boxY + 14, { align: "center" });

  pdf.setFontSize(12);
  pdf.text(`Nº ${document.folio}`, boxX + boxWidth / 2, boxY + 21, { align: "center" });

  pdf.setFontSize(7.5);
  pdf.text("S.I.I. - SANTIAGO CENTRO", boxX + boxWidth / 2, boxY + 26, { align: "center" });

  // 2. Top Left: Issuer Information (Modern & Stylized)
  pdf.setTextColor(10, 23, 51); // Deep Navy
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text(document.issuer.name, margin, 18);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(71, 85, 105);
  const issuerLines: string[] = [];
  if (document.issuer.businessLine) issuerLines.push(`Giro: ${document.issuer.businessLine}`);
  if (document.issuer.address) issuerLines.push(`Casa Matriz: ${document.issuer.address}`);
  if (document.issuer.commune || document.issuer.city) {
    issuerLines.push(`${document.issuer.commune ? `${document.issuer.commune}, ` : ""}${document.issuer.city ?? ""}`);
  }
  pdf.text(pdf.splitTextToSize(issuerLines.join("\n"), boxX - margin - 4), margin, 24);

  // 3. Receptor (Client) Box - Modern Styled Container
  const clientBoxY = 44;
  const clientBoxHeight = 28;
  pdf.setDrawColor(226, 232, 240); // Slate 200
  pdf.setFillColor(248, 250, 252); // Slate 50
  pdf.setLineWidth(0.3);
  pdf.roundedRect(margin, clientBoxY, width - margin * 2, clientBoxHeight, 2, 2, "FD");

  // Client Details Columns
  pdf.setTextColor(10, 23, 51);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("SEÑOR(ES):", margin + 4, clientBoxY + 6);
  pdf.setFont("helvetica", "normal");
  pdf.text(document.receiver.name, margin + 25, clientBoxY + 6);

  pdf.setFont("helvetica", "bold");
  pdf.text("R.U.T.:", margin + 4, clientBoxY + 12);
  pdf.setFont("helvetica", "normal");
  pdf.text(formatRutWithDots(document.receiver.rut), margin + 25, clientBoxY + 12);

  pdf.setFont("helvetica", "bold");
  pdf.text("GIRO:", margin + 4, clientBoxY + 18);
  pdf.setFont("helvetica", "normal");
  pdf.text(pdf.splitTextToSize(document.receiver.businessLine || "Sin giro especificado", 75), margin + 25, clientBoxY + 18);

  pdf.setFont("helvetica", "bold");
  pdf.text("DIRECCIÓN:", margin + 4, clientBoxY + 24);
  pdf.setFont("helvetica", "normal");
  pdf.text(`${document.receiver.address || ""} ${document.receiver.commune ? `, ${document.receiver.commune}` : ""}`, margin + 25, clientBoxY + 24);

  // Right column of Client Box: Dates
  const rightColX = width / 2 + 10;
  pdf.setFont("helvetica", "bold");
  pdf.text("FECHA EMISIÓN:", rightColX, clientBoxY + 6);
  pdf.setFont("helvetica", "normal");
  pdf.text(document.issueDate, rightColX + 32, clientBoxY + 6);

  pdf.setFont("helvetica", "bold");
  pdf.text("FECHA VENC.:", rightColX, clientBoxY + 12);
  pdf.setFont("helvetica", "normal");
  pdf.text(document.dueDate || "Contado", rightColX + 32, clientBoxY + 12);

  pdf.setFont("helvetica", "bold");
  pdf.text("CIUDAD:", rightColX, clientBoxY + 18);
  pdf.setFont("helvetica", "normal");
  pdf.text(document.receiver.city || "Santiago", rightColX + 32, clientBoxY + 18);

  // 4. Line Items Table
  let y = clientBoxY + clientBoxHeight + 6;
  autoTable(pdf, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["#", "Detalle de Producto / Servicio", "Cant.", "P. Unitario", "Descto.", "Subtotal"]],
    body: document.details.map((item) => [
      String(item.lineNumber),
      item.description ? `${item.name}\n${item.description}` : item.name,
      String(item.quantity),
      money(item.unitPrice),
      item.discountAmount ? `${money(item.discountAmount)}${item.discountPercent !== null ? ` (${item.discountPercent}%)` : ""}` : "—",
      money(item.amount),
    ]),
    styles: {
      fontSize: 8,
      cellPadding: 3,
      textColor: [10, 23, 51],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [10, 23, 51], // Deep Brand Navy
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "left",
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 80 },
      2: { cellWidth: 16, halign: "center" },
      3: { cellWidth: 26, halign: "right" },
      4: { cellWidth: 22, halign: "right" },
      5: { cellWidth: 28, halign: "right", fontStyle: "bold" },
    },
  });

  y = (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20;

  // References if any
  if (document.references.length) {
    y += 6;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(10, 23, 51);
    pdf.text("REFERENCIAS DOCUMENTARIAS", margin, y);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(71, 85, 105);
    pdf.text(
      document.references.map((r) => `${r.type} / Folio ${r.folio}${r.reason ? ` · ${r.reason}` : ""}`).join("\n"),
      margin,
      y + 5
    );
    y += 6 + document.references.length * 4;
  }

  // 5. Totals & Barcode Section
  const totalsBoxWidth = 72;
  const totalsBoxX = width - margin - totalsBoxWidth;
  const footerNeeded = 75;

  if (y + footerNeeded > height - 12) {
    pdf.addPage();
    y = 20;
  } else {
    y = Math.max(y + 8, 160);
  }

  // Totals Box (Right Side)
  const totalsBoxY = y;
  pdf.setDrawColor(226, 232, 240);
  pdf.setFillColor(248, 250, 252);
  pdf.roundedRect(totalsBoxX, totalsBoxY, totalsBoxWidth, 42, 2, 2, "FD");

  pdf.setFontSize(8);
  pdf.setTextColor(71, 85, 105);

  pdf.text("Monto Neto:", totalsBoxX + 4, totalsBoxY + 7);
  pdf.text(money(document.totals.net), totalsBoxX + totalsBoxWidth - 4, totalsBoxY + 7, { align: "right" });

  pdf.text("Monto Exento:", totalsBoxX + 4, totalsBoxY + 14);
  pdf.text(money(document.totals.exempt), totalsBoxX + totalsBoxWidth - 4, totalsBoxY + 14, { align: "right" });

  pdf.text(`I.V.A. (${document.totals.ivaRate}%):`, totalsBoxX + 4, totalsBoxY + 21);
  pdf.text(money(document.totals.iva), totalsBoxX + totalsBoxWidth - 4, totalsBoxY + 21, { align: "right" });

  const totalDiscount = document.details.reduce((sum, item) => sum + item.discountAmount, 0);
  if (totalDiscount > 0) {
    pdf.text("Descuento:", totalsBoxX + 4, totalsBoxY + 28);
    pdf.text(`-${money(totalDiscount)}`, totalsBoxX + totalsBoxWidth - 4, totalsBoxY + 28, { align: "right" });
  }

  // Final Total Banner
  pdf.setFillColor(15, 42, 107); // Royal Brand Blue
  pdf.roundedRect(totalsBoxX, totalsBoxY + 31, totalsBoxWidth, 11, 0, 0, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text("TOTAL:", totalsBoxX + 4, totalsBoxY + 38);
  pdf.setFontSize(10.5);
  pdf.text(money(document.totals.total), totalsBoxX + totalsBoxWidth - 4, totalsBoxY + 38, { align: "right" });

  // TED Barcode (Left Side)
  const barcode = await renderTedPdf417(document.tedXml);
  const barcodeWidth = 88;
  const barcodeHeight = 28;

  pdf.addImage(barcode, "PNG", margin, totalsBoxY, barcodeWidth, barcodeHeight);

  // Legal footer under TED Barcode
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.setTextColor(10, 23, 51);
  pdf.text("Timbre Electrónico S.I.I.", margin + barcodeWidth / 2, totalsBoxY + barcodeHeight + 4, { align: "center" });

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(6.5);
  pdf.setTextColor(100, 116, 139);
  if (document.resolution.number || document.resolution.date) {
    pdf.text(`Res. N° ${document.resolution.number ?? "80"} de ${document.resolution.date ?? "2014"} - Verifique documento: www.sii.cl`, margin + barcodeWidth / 2, totalsBoxY + barcodeHeight + 7.5, { align: "center" });
  }

  return new Uint8Array(pdf.output("arraybuffer"));
}
