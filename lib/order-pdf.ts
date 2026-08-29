import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type ServiceType = "hosting" | "custom";

export type OrderItem = {
  id: string;
  name: string;
  description: string;
  amount: number;
  discountAmount?: number;
  netAmount?: number;
  taxRate?: number;
  taxAmount?: number;
  total?: number;
  taxable?: boolean;
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
  discountPercent: number;
  discountReason: string;
  notes?: string;
  items: OrderItem[];
  subtotal?: number;
  discountTotal?: number;
  taxableBase?: number;
  exemptBase?: number;
  taxTotal?: number;
  total?: number;
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

export type CommercialPdfTotals = {
  subtotal: number;
  discount: number;
  taxableBase: number;
  exemptBase: number;
  tax: number;
  total: number;
};

function hasPersistedLineValues(item: OrderItem): boolean {
  return [item.discountAmount, item.netAmount, item.taxRate, item.taxAmount, item.total, item.taxable].every((value) => value !== undefined && Number.isFinite(Number(value)));
}

export function resolveCommercialTotals(order: PaymentOrder): CommercialPdfTotals {
  const persisted = [order.subtotal, order.discountTotal, order.taxTotal, order.total].every((value) => value !== undefined && Number.isFinite(Number(value))) && order.items.every(hasPersistedLineValues);
  if (persisted) {
    return {
      subtotal: Math.round(Number(order.subtotal)),
      discount: Math.round(Number(order.discountTotal)),
      taxableBase: order.items.filter((item) => item.taxable).reduce((sum, item) => sum + Math.round(Number(item.netAmount)), 0),
      exemptBase: order.items.filter((item) => !item.taxable).reduce((sum, item) => sum + Math.round(Number(item.netAmount)), 0),
      tax: Math.round(Number(order.taxTotal)),
      total: Math.round(Number(order.total)),
    };
  }

  const subtotal = order.items.reduce((sum, item) => sum + Math.round(item.amount || 0), 0);
  const discountPercent = Math.min(100, Math.max(0, Number(order.discountPercent) || 0));
  const discount = Math.round(subtotal * (discountPercent / 100));
  const discountedSubtotal = Math.max(0, subtotal - discount);
  const tax = order.invoice ? Math.round(discountedSubtotal * 0.19) : 0;
  return { subtotal, discount, taxableBase: order.invoice ? discountedSubtotal : 0, exemptBase: order.invoice ? 0 : discountedSubtotal, tax, total: discountedSubtotal + tax };
}

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
  const totals = resolveCommercialTotals(order);
  const { subtotal, discount, taxableBase, exemptBase, tax, total } = totals;
  const discountPercent = Math.min(100, Math.max(0, Number(order.discountPercent) || (subtotal > 0 ? discount / subtotal * 100 : 0)));
  const discountedSubtotal = Math.max(0, subtotal - discount);
  const persistedLineValues = order.items.every(hasPersistedLineValues);
  const taxable = persistedLineValues ? order.items.some((item) => item.taxable) : order.invoice;

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

  const sectionTitle = (title: string, y: number, x = margin, lineWidth = 18) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...colors.navy);
    doc.text(title.toUpperCase(), x, y);
    doc.setDrawColor(...colors.cyan);
    doc.setLineWidth(0.8);
    doc.line(x, y + 2.2, x + lineWidth, y + 2.2);
    return y + 6;
  };

  drawTopBand();

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", margin, 10, 42, 28, undefined, "FAST");
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...colors.deep);
  doc.text("ORDEN DE PAGO", pageWidth - margin, 17, { align: "right" });
  doc.setFontSize(9.5);
  doc.setTextColor(...colors.royal);
  doc.text(order.number, pageWidth - margin, 23.5, { align: "right" });

  const badgeText = taxable ? "CON IVA" : "EXENTO";
  const badgeWidth = doc.getTextWidth(badgeText) + 8;
  doc.setFillColor(...(taxable ? colors.navy : colors.pale));
  doc.roundedRect(
    pageWidth - margin - badgeWidth,
    27,
    badgeWidth,
    6.5,
    2,
    2,
    "F",
  );
  doc.setFontSize(7.2);
  doc.setTextColor(...(taxable ? colors.white : colors.slate));
  doc.text(badgeText, pageWidth - margin - badgeWidth / 2, 31.4, {
    align: "center",
  });

  let y = 38;
  doc.setFillColor(...colors.pale);
  doc.roundedRect(margin, y, contentWidth, 31, 2.5, 2.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...colors.navy);
  doc.text("EMISOR", margin + 5, y + 5.5);
  doc.setFontSize(8);
  doc.setTextColor(...colors.deep);
  doc.text(safe(settings.companyName), margin + 5, y + 10.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...colors.slate);
  doc.setFontSize(7.5);
  doc.text(`RUT ${safe(settings.companyRut, "-")}`, margin + 5, y + 15);
  doc.text(
    safe(settings.businessLine, "Servicios tecnológicos"),
    margin + 5,
    y + 19.5,
  );
  doc.setFontSize(7);
  doc.text(safe(settings.address, "-"), margin + 5, y + 23.5);
  const contactLine = [settings.email.trim(), settings.phone.trim()]
    .filter(Boolean)
    .join(" · ");
  doc.text(contactLine || "-", margin + 5, y + 27.5);

  const metaX = margin + 110;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...colors.navy);
  doc.text("EMISIÓN", metaX, y + 5.5);
  doc.text("VENCIMIENTO", metaX, y + 15);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...colors.deep);
  doc.text(formatDate(order.issueDate), pageWidth - margin - 5, y + 5.5, {
    align: "right",
  });
  doc.text(formatDate(order.dueDate), pageWidth - margin - 5, y + 15, {
    align: "right",
  });

  y += 35;
  y = sectionTitle("Cliente", y);
  doc.setFillColor(...colors.white);
  doc.setDrawColor(...colors.line);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y - 2, contentWidth, 14, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...colors.deep);
  doc.text(safe(order.customerName), margin + 5, y + 3.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...colors.slate);
  doc.text(`RUT: ${safe(order.customerRut, "-")}`, margin + 5, y + 8.5);
  doc.text(
    `Correo: ${safe(order.customerEmail, "-")}`,
    margin + 70,
    y + 8.5,
  );

  y += 16;
  y = sectionTitle("Detalle del servicio", y);
  autoTable(doc, {
    startY: y - 2,
    margin: { left: margin, right: margin, bottom: 20 },
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
      cellPadding: 2.8,
    },
    bodyStyles: {
      textColor: colors.deep,
      fontSize: 8,
      cellPadding: 2.8,
      lineColor: colors.line,
      lineWidth: 0.2,
      valign: "middle",
    },
    alternateRowStyles: { fillColor: colors.pale },
    columnStyles: {
      0: { cellWidth: 42, fontStyle: "bold" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 35, halign: "right", fontStyle: "bold" },
    },
    didDrawPage: () => drawTopBand(),
  });

  const tableDoc = doc as jsPDF & { lastAutoTable: { finalY: number } };
  const afterTableY = tableDoc.lastAutoTable.finalY + 5;

  const totalsWidth = 72;
  const totalsX = pageWidth - margin - totalsWidth;
  const leftWidth = totalsX - margin - 6;
  const leftX = margin;

  const hasDiscount = discount > 0;
  const hasMixedTax = persistedLineValues && exemptBase > 0;
  const hasReason = Boolean(hasDiscount && order.discountReason && order.discountReason.trim());
  const totalsHeight = 22 + (hasDiscount ? (hasReason ? 14 : 9) : 0) + (hasMixedTax ? 10 : 0);

  const blockStartY = ensureSpace(afterTableY, totalsHeight + 25);

  // Right Column: Totales
  doc.setFillColor(...colors.pale);
  doc.roundedRect(totalsX, blockStartY, totalsWidth, totalsHeight, 2.5, 2.5, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...colors.slate);

  let totalLineY = blockStartY + 5;
  doc.text("Subtotal neto", totalsX + 4, totalLineY);
  doc.text(formatClp(subtotal), pageWidth - margin - 4, totalLineY, {
    align: "right",
  });

  if (hasDiscount) {
    totalLineY += 4.5;
    doc.setTextColor(180, 55, 48);
    doc.text(`Descuento (${discountPercent}%)`, totalsX + 4, totalLineY);
    doc.text(`-${formatClp(discount)}`, pageWidth - margin - 4, totalLineY, {
      align: "right",
    });

    if (hasReason) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(6);
      doc.setTextColor(...colors.slate);
      const fullReason = doc.splitTextToSize(
        `Motivo: ${order.discountReason.trim()}`,
        totalsWidth - 8,
      ) as string[];
      const reasonLine = fullReason[0] + (fullReason.length > 1 ? "..." : "");
      totalLineY += 3.2;
      doc.text(reasonLine, totalsX + 4, totalLineY);
      totalLineY += 1.2;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...colors.slate);
    totalLineY += 4.5;
    doc.text("Neto con descuento", totalsX + 4, totalLineY);
    doc.text(
      formatClp(discountedSubtotal),
      pageWidth - margin - 4,
      totalLineY,
      { align: "right" },
    );
  }

  if (hasMixedTax) {
    totalLineY += 4.5;
    doc.text("Base afecta", totalsX + 4, totalLineY);
    doc.text(formatClp(taxableBase), pageWidth - margin - 4, totalLineY, { align: "right" });
    totalLineY += 4.5;
    doc.text("Base exenta", totalsX + 4, totalLineY);
    doc.text(formatClp(exemptBase), pageWidth - margin - 4, totalLineY, { align: "right" });
  }

  totalLineY += 4.5;
  doc.text(persistedLineValues ? "IVA" : order.invoice ? "IVA (19%)" : "IVA (sin factura)", totalsX + 4, totalLineY);
  doc.text(formatClp(tax), pageWidth - margin - 4, totalLineY, {
    align: "right",
  });

  doc.setDrawColor(...colors.line);
  doc.line(
    totalsX + 4,
    totalLineY + 2.5,
    pageWidth - margin - 4,
    totalLineY + 2.5,
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...colors.navy);
  totalLineY += 7.5;
  doc.text("TOTAL", totalsX + 4, totalLineY);
  doc.text(formatClp(total), pageWidth - margin - 4, totalLineY, {
    align: "right",
  });

  const rightBottomY = blockStartY + totalsHeight;

  // Left Column: Datos para transferencia
  let leftY = blockStartY;
  sectionTitle("Datos para transferencia", leftY, leftX, 22);
  const transferBoxY = leftY + 5;
  const transferBoxHeight = 23;

  doc.setFillColor(...colors.white);
  doc.setDrawColor(...colors.line);
  doc.setLineWidth(0.3);
  doc.roundedRect(leftX, transferBoxY, leftWidth, transferBoxHeight, 2.5, 2.5, "FD");

  doc.setFontSize(7.5);
  const paymentLines = [
    safe(settings.accountHolder, settings.companyName || "INTELLY SPA"),
    `RUT ${safe(settings.accountRut, settings.companyRut || "-")}`,
    safe(settings.bankName),
    `${safe(settings.accountType)} · ${safe(settings.accountNumber)}`,
    `Comprobante: ${safe(settings.transferEmail, settings.email || "-")}`,
  ];
  paymentLines.forEach((line, index) => {
    doc.setFont("helvetica", index === 0 ? "bold" : "normal");
    doc.setTextColor(...(index === 0 ? colors.navy : colors.slate));
    doc.text(line, leftX + 4, transferBoxY + 3.8 + index * 3.7);
  });

  leftY = transferBoxY + transferBoxHeight;

  // Left Column: Observaciones al cliente
  const hasNotes = Boolean(order.notes && order.notes.trim());
  if (hasNotes) {
    leftY += 3.5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...colors.navy);
    doc.text("OBSERVACIONES AL CLIENTE", leftX, leftY + 2.5);
    doc.setDrawColor(...colors.cyan);
    doc.setLineWidth(0.6);
    doc.line(leftX, leftY + 3.5, leftX + 16, leftY + 3.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2);
    doc.setTextColor(...colors.slate);
    const wrappedNotes = doc.splitTextToSize(order.notes!.trim(), leftWidth - 8) as string[];
    const notesLineHeight = 3.3;
    const notesBoxHeight = Math.max(9, wrappedNotes.length * notesLineHeight + 4);

    const notesBoxY = leftY + 5.5;
    doc.setFillColor(...colors.white);
    doc.setDrawColor(...colors.line);
    doc.setLineWidth(0.3);
    doc.roundedRect(leftX, notesBoxY, leftWidth, notesBoxHeight, 2, 2, "FD");

    wrappedNotes.forEach((line, idx) => {
      doc.text(line, leftX + 4, notesBoxY + 3 + idx * notesLineHeight);
    });

    leftY = notesBoxY + notesBoxHeight;
  }

  y = Math.max(leftY, rightBottomY) + 5;
  const conditionParagraphs = [
    safe(settings.paymentTerms, "Pago dentro del plazo indicado."),
    settings.paymentInstructions.trim(),
  ].filter(Boolean);

  const conditionsBottom = pageHeight - 14.5;
  let conditionsFontSize = 7.5;
  let conditionsLineHeight = 3.4;
  let conditionsParagraphGap = 1.2;
  let wrappedConditions: string[][] = [];
  let conditionsHeight = 0;

  const measureConditions = () => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(conditionsFontSize);
    wrappedConditions = conditionParagraphs.map(
      (paragraph) => doc.splitTextToSize(paragraph, contentWidth) as string[],
    );
    conditionsHeight =
      wrappedConditions.reduce(
        (height, lines) => height + lines.length * conditionsLineHeight,
        0,
      ) +
      Math.max(0, wrappedConditions.length - 1) * conditionsParagraphGap;
  };

  measureConditions();
  while (
    y + 6 + conditionsHeight > conditionsBottom &&
    conditionsFontSize > 6
  ) {
    conditionsFontSize = Math.max(6, conditionsFontSize - 0.3);
    conditionsLineHeight = conditionsFontSize * 0.42;
    conditionsParagraphGap = 0.6;
    measureConditions();
  }

  y = sectionTitle("Condiciones y plazos", y);
  if (y + conditionsHeight > conditionsBottom) {
    autoTable(doc, {
      startY: y - 2,
      margin: { left: margin, right: margin, bottom: 20 },
      theme: "plain",
      body: [[conditionParagraphs.join("\n\n")]],
      bodyStyles: {
        fontSize: conditionsFontSize,
        textColor: colors.slate,
        cellPadding: 0,
        lineWidth: 0,
      },
      styles: { overflow: "linebreak", cellWidth: "wrap" },
      didDrawPage: () => drawTopBand(),
    });
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(conditionsFontSize);
    doc.setTextColor(...colors.slate);
    let conditionLineY = y;
    wrappedConditions.forEach((paragraph, paragraphIndex) => {
      paragraph.forEach((line) => {
        doc.text(line, margin, conditionLineY);
        conditionLineY += conditionsLineHeight;
      });
      if (paragraphIndex < wrappedConditions.length - 1) {
        conditionLineY += conditionsParagraphGap;
      }
    });
  }

  addFooter();
  doc.setProperties({
    title: `Orden de pago ${order.number}`,
    subject: `Orden de pago Intelly para ${order.customerName}`,
    author: settings.companyName || "Intelly",
    creator: "Generador de Órdenes de Pago Intelly",
  });

  return doc;
}
