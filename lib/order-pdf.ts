import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type ServiceType = "hosting" | "custom";

export type OrderItem = {
  id: string;
  name: string;
  description: string;
  amount: number;
};

export type CompanySettings = {
  companyName: string;
  companyRut: string;
  businessLine: string;
  address: string;
  email: string;
  phone: string;
  bankName: string;
  accountType: string;
  accountNumber: string;
  accountHolder: string;
  accountRut: string;
  transferEmail: string;
  paymentTerms: string;
  paymentInstructions: string;
  dueDays: number;
};

export type PaymentOrder = {
  id: string;
  number: string;
  committed: boolean;
  issueDate: string;
  dueDate: string;
  customerName: string;
  customerRut: string;
  customerEmail: string;
  serviceType: ServiceType;
  invoice: boolean;
  items: OrderItem[];
  createdAt?: string;
  updatedAt?: string;
};

export type PdfPayload = {
  order: PaymentOrder;
  settings: CompanySettings;
  logoDataUrl: string;
};

const colors = {
  navy: [15, 42, 107] as [number, number, number],
  deep: [10, 23, 51] as [number, number, number],
  cyan: [20, 208, 246] as [number, number, number],
  blue: [47, 167, 255] as [number, number, number],
  royal: [27, 75, 224] as [number, number, number],
  slate: [71, 85, 105] as [number, number, number],
  pale: [245, 247, 250] as [number, number, number],
  line: [226, 232, 240] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

export const formatClp = (amount: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(Math.round(amount || 0));

export const formatDate = (value: string) => {
  if (!value) return "-";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
};

const safe = (value: string, fallback = "No informado") =>
  value.trim() || fallback;

export function buildOrderPdf({ order, settings, logoDataUrl }: PdfPayload) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  const subtotal = order.items.reduce(
    (sum, item) => sum + Math.round(item.amount || 0),
    0,
  );
  const tax = order.invoice ? Math.round(subtotal * 0.19) : 0;
  const total = subtotal + tax;

  const drawTopBand = () => {
    const bandWidth = pageWidth / 3;
    doc.setFillColor(...colors.cyan);
    doc.rect(0, 0, bandWidth + 0.5, 3.2, "F");
    doc.setFillColor(...colors.blue);
    doc.rect(bandWidth, 0, bandWidth + 0.5, 3.2, "F");
    doc.setFillColor(...colors.royal);
    doc.rect(bandWidth * 2, 0, bandWidth + 0.5, 3.2, "F");
  };

  const addFooter = () => {
    const pages = doc.getNumberOfPages();
    for (let page = 1; page <= pages; page += 1) {
      doc.setPage(page);
      doc.setDrawColor(...colors.line);
      doc.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...colors.slate);
      doc.text(
        "Documento generado por Intelly · Orden de pago",
        margin,
        pageHeight - 8,
      );
      doc.text(
        `Página ${page} de ${pages}`,
        pageWidth - margin,
        pageHeight - 8,
        { align: "right" },
      );
      drawTopBand();
    }
  };

  const newPage = () => {
    doc.addPage();
    drawTopBand();
    return 15;
  };

  const ensureSpace = (y: number, needed: number) =>
    y + needed > pageHeight - 19 ? newPage() : y;

  const sectionTitle = (title: string, y: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...colors.navy);
    doc.text(title.toUpperCase(), margin, y);
    doc.setDrawColor(...colors.cyan);
    doc.setLineWidth(0.8);
    doc.line(margin, y + 2.4, margin + 18, y + 2.4);
    return y + 7;
  };

  drawTopBand();

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", margin, 11, 45, 30, undefined, "FAST");
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...colors.deep);
  doc.text("ORDEN DE PAGO", pageWidth - margin, 18, { align: "right" });
  doc.setFontSize(10);
  doc.setTextColor(...colors.royal);
  doc.text(order.number, pageWidth - margin, 25, { align: "right" });

  const badgeText = order.invoice ? "CON FACTURA" : "SIN FACTURA";
  const badgeWidth = doc.getTextWidth(badgeText) + 8;
  doc.setFillColor(...(order.invoice ? colors.navy : colors.pale));
  doc.roundedRect(
    pageWidth - margin - badgeWidth,
    29,
    badgeWidth,
    7,
    2,
    2,
    "F",
  );
  doc.setFontSize(7.5);
  doc.setTextColor(...(order.invoice ? colors.white : colors.slate));
  doc.text(badgeText, pageWidth - margin - badgeWidth / 2, 33.7, {
    align: "center",
  });

  let y = 46;
  doc.setFillColor(...colors.pale);
  doc.roundedRect(margin, y, contentWidth, 37, 3, 3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...colors.navy);
  doc.text("EMISOR", margin + 5, y + 7);
  doc.setFontSize(8.5);
  doc.setTextColor(...colors.deep);
  doc.text(safe(settings.companyName), margin + 5, y + 13);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...colors.slate);
  doc.text(`RUT ${safe(settings.companyRut, "-")}`, margin + 5, y + 18);
  doc.text(
    safe(settings.businessLine, "Servicios tecnológicos"),
    margin + 5,
    y + 23,
  );
  doc.setFontSize(7.2);
  doc.text(safe(settings.address, "-"), margin + 5, y + 28);
  const contactLine = [settings.email.trim(), settings.phone.trim()]
    .filter(Boolean)
    .join(" · ");
  doc.text(contactLine || "-", margin + 5, y + 33);

  const metaX = margin + 110;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...colors.navy);
  doc.text("EMISIÓN", metaX, y + 7);
  doc.text("VENCIMIENTO", metaX, y + 18);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...colors.deep);
  doc.text(formatDate(order.issueDate), pageWidth - margin - 5, y + 7, {
    align: "right",
  });
  doc.text(formatDate(order.dueDate), pageWidth - margin - 5, y + 18, {
    align: "right",
  });

  y += 45;
  y = sectionTitle("Cliente", y);
  doc.setFillColor(...colors.white);
  doc.setDrawColor(...colors.line);
  doc.roundedRect(margin, y - 2, contentWidth, 19, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...colors.deep);
  doc.text(safe(order.customerName), margin + 5, y + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...colors.slate);
  doc.text(`RUT: ${safe(order.customerRut, "-")}`, margin + 5, y + 11);
  doc.text(
    `Correo: ${safe(order.customerEmail, "-")}`,
    margin + 70,
    y + 11,
  );

  y += 25;
  y = sectionTitle("Detalle del servicio", y);
  autoTable(doc, {
    startY: y - 2,
    margin: { left: margin, right: margin, bottom: 22 },
    theme: "grid",
    head: [["ITEM", "DESCRIPCIÓN", "SUBTOTAL"]],
    body: order.items.map((item) => [
      safe(item.name, "Servicio"),
      safe(item.description, "-"),
      formatClp(item.amount),
    ]),
    headStyles: {
      fillColor: colors.navy,
      textColor: colors.white,
      fontStyle: "bold",
      fontSize: 8,
      cellPadding: 3.2,
    },
    bodyStyles: {
      textColor: colors.deep,
      fontSize: 8.3,
      cellPadding: 3.2,
      lineColor: colors.line,
      lineWidth: 0.2,
      valign: "middle",
    },
    alternateRowStyles: { fillColor: colors.pale },
    columnStyles: {
      0: { cellWidth: 43, fontStyle: "bold" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 36, halign: "right", fontStyle: "bold" },
    },
    didDrawPage: () => drawTopBand(),
  });

  const tableDoc = doc as jsPDF & { lastAutoTable: { finalY: number } };
  y = tableDoc.lastAutoTable.finalY + 8;
  y = ensureSpace(y, 31);

  const totalsX = pageWidth - margin - 75;
  doc.setFillColor(...colors.pale);
  doc.roundedRect(totalsX, y, 75, 28, 3, 3, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...colors.slate);
  doc.text("Subtotal neto", totalsX + 5, y + 7);
  doc.text(formatClp(subtotal), pageWidth - margin - 5, y + 7, {
    align: "right",
  });
  doc.text(order.invoice ? "IVA (19%)" : "IVA (sin factura)", totalsX + 5, y + 14);
  doc.text(formatClp(tax), pageWidth - margin - 5, y + 14, { align: "right" });
  doc.setDrawColor(...colors.line);
  doc.line(totalsX + 5, y + 18, pageWidth - margin - 5, y + 18);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...colors.navy);
  doc.text("TOTAL", totalsX + 5, y + 25);
  doc.text(formatClp(total), pageWidth - margin - 5, y + 25, {
    align: "right",
  });

  y += 37;
  y = ensureSpace(y, 54);
  y = sectionTitle("Datos para transferencia", y);

  doc.setFillColor(...colors.navy);
  doc.roundedRect(margin, y - 2, contentWidth, 31, 3, 3, "F");
  doc.setFontSize(8.2);
  doc.setTextColor(...colors.white);
  doc.setFont("helvetica", "bold");
  doc.text(safe(settings.bankName), margin + 6, y + 6);
  doc.setFont("helvetica", "normal");
  doc.text(
    `${safe(settings.accountType)} · ${safe(settings.accountNumber)}`,
    margin + 6,
    y + 13,
  );
  doc.text(
    `Titular: ${safe(settings.accountHolder)} · RUT ${safe(settings.accountRut, "-")}`,
    margin + 6,
    y + 20,
  );
  doc.text(
    `Comprobante: ${safe(settings.transferEmail, settings.email || "-")}`,
    margin + 6,
    y + 27,
  );

  y += 38;
  y = sectionTitle("Condiciones y plazos", y);
  const conditions = [
    safe(settings.paymentTerms, "Pago dentro del plazo indicado."),
    settings.paymentInstructions.trim(),
  ]
    .filter(Boolean)
    .join("\n\n");
  autoTable(doc, {
    startY: y - 2,
    margin: { left: margin, right: margin, bottom: 20 },
    theme: "plain",
    body: [[conditions]],
    bodyStyles: {
      fontSize: 8.2,
      textColor: colors.slate,
      cellPadding: 0,
      lineWidth: 0,
    },
    styles: { overflow: "linebreak", cellWidth: "wrap" },
    didDrawPage: () => drawTopBand(),
  });

  addFooter();
  doc.setProperties({
    title: `Orden de pago ${order.number}`,
    subject: `Orden de pago Intelly para ${order.customerName}`,
    author: settings.companyName || "Intelly",
    creator: "Generador de Órdenes de Pago Intelly",
  });

  return doc;
}
