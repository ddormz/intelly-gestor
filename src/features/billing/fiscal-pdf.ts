import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { ParsedDteDocument } from "./xml";
import { renderTedPdf417 } from "./xml";

const money = (value: number) => `$${Math.round(value).toLocaleString("es-CL")}`;

export async function renderFiscalPdf(document: ParsedDteDocument): Promise<Uint8Array> {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const margin = 14;
  pdf.setDrawColor(31, 58, 95);
  pdf.setLineWidth(0.5);
  pdf.rect(margin, 12, width - margin * 2, 27);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  pdf.text("FACTURA ELECTRÓNICA", margin + 5, 21);
  pdf.setFontSize(10);
  pdf.text(`DTE ${document.type} · FOLIO ${document.folio}`, margin + 5, 29);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Emisión: ${document.issueDate}`, margin + 5, 35);
  pdf.text(`Vencimiento: ${document.dueDate ?? "—"}`, width / 2, 35);
  pdf.setFont("helvetica", "bold");
  pdf.text("EMISOR", width - 82, 20);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text(pdf.splitTextToSize(`${document.issuer.name}\nRUT: ${document.issuer.rut}\n${document.issuer.businessLine ?? ""}\n${document.issuer.address ?? ""}`, 70), width - 82, 25);
  let y = 47;
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.text("RECEPTOR", margin, y);
  pdf.setFont("helvetica", "normal");
  pdf.text(pdf.splitTextToSize(`${document.receiver.name} · RUT: ${document.receiver.rut}\n${document.receiver.businessLine ?? ""} · ${document.receiver.address ?? ""}\n${document.receiver.commune ?? ""} · ${document.receiver.city ?? ""}`, width - margin * 2), margin, y + 5);
  y += 22;
  autoTable(pdf, { startY: y, margin: { left: margin, right: margin }, head: [["#", "Detalle", "Cant.", "P. unitario", "Descuento", "Monto"]], body: document.details.map((item) => [String(item.lineNumber), item.description ? `${item.name} · ${item.description}` : item.name, String(item.quantity), money(item.unitPrice), item.discountAmount ? `${money(item.discountAmount)}${item.discountPercent !== null ? ` (${item.discountPercent}%)` : ""}` : "—", money(item.amount)]), styles: { fontSize: 8, cellPadding: 2 }, headStyles: { fillColor: [31, 58, 95] }, columnStyles: { 1: { cellWidth: 62 }, 5: { halign: "right" } } });
  y = (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20;
  if (document.references.length) {
    y += 8;
    pdf.setFont("helvetica", "bold");
    pdf.text("REFERENCIAS", margin, y);
    pdf.setFont("helvetica", "normal");
    pdf.text(document.references.map((reference) => `${reference.type} / Folio ${reference.folio}${reference.reason ? ` · ${reference.reason}` : ""}`).join("\n"), margin, y + 5);
    y += 8 + document.references.length * 4;
  }
  const totalsX = width - 75;
  const requiredFooterHeight = 86;
  if (y + requiredFooterHeight > height - 12) {
    pdf.addPage();
    y = 20;
  } else {
    y = Math.max(y + 10, 150);
  }
  pdf.setFont("helvetica", "normal");
  pdf.text(`Neto: ${money(document.totals.net)}`, totalsX, y);
  pdf.text(`Exento: ${money(document.totals.exempt)}`, totalsX, y + 5);
  pdf.text(`IVA (${document.totals.ivaRate}%): ${money(document.totals.iva)}`, totalsX, y + 10);
  pdf.text(`Descuentos: ${money(document.details.reduce((sum, item) => sum + item.discountAmount, 0))}`, totalsX, y + 15);
  pdf.setFont("helvetica", "bold");
  pdf.text(`TOTAL: ${money(document.totals.total)}`, totalsX, y + 22);
  const barcode = await renderTedPdf417(document.tedXml);
  const barcodeY = y + 30;
  if (barcodeY + 30 > height - 10) {
    pdf.addPage();
    pdf.addImage(barcode, "PNG", margin, 20, 96, 24);
    y = 20;
  } else {
    pdf.addImage(barcode, "PNG", margin, barcodeY, 96, 24);
  }
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.text("Timbre electrónico derivado del TED firmado original.", margin, y + 59);
  if (document.resolution.number || document.resolution.date) pdf.text(`Resolución SII N° ${document.resolution.number ?? "—"} de fecha ${document.resolution.date ?? "—"}`, margin, y + 65);
  return new Uint8Array(pdf.output("arraybuffer"));
}
