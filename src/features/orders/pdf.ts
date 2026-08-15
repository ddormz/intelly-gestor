import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildOrderPdf, type CompanySettings, type PaymentOrder } from "../../../lib/order-pdf";

export type OrderPdfHeader = {
  id: string;
  number: string;
  status: string;
  subtotal: string;
  discountTotal: string;
  discountReason?: string | null;
  taxTotal: string;
  total?: string;
  createdAt: Date;
  issuedAt: Date | null;
  dueAt: Date | null;
  clientName: string;
  clientTaxId: string | null;
  clientEmail: string;
};

export type OrderPdfLine = {
  id: string;
  code: string | null;
  description: string;
  quantity: string;
  subtotal: string;
  discountAmount?: string;
  taxRate?: string;
  taxAmount?: string;
  total?: string;
};

export const INTELLY_PDF_SETTINGS: CompanySettings = {
  companyName: "INTELLY SPA",
  companyRut: "78.202.703-4",
  businessLine: "",
  address: "",
  email: "dramirez@intelly.cl",
  phone: "",
  bankName: "Banco de Chile",
  accountType: "Cuenta Corriente",
  accountNumber: "00-171-21318-01",
  accountHolder: "INTELLY SPA",
  accountRut: "78.202.703-4",
  transferEmail: "dramirez@intelly.cl",
  paymentTerms: "",
  paymentInstructions: "",
  dueDays: 10,
};

const dateOnly = (date: Date) => date.toISOString().slice(0, 10);

export function toLegacyPaymentOrder(header: OrderPdfHeader, lines: OrderPdfLine[]): PaymentOrder {
  const issueDate = header.issuedAt ?? header.createdAt;
  const dueDate = header.dueAt ?? new Date(issueDate.getTime() + INTELLY_PDF_SETTINGS.dueDays * 86_400_000);
  const lineSubtotal = lines.reduce((sum, line) => sum + Number(line.subtotal), 0);
  const discount = Number(header.discountTotal);
  const discountPercent = lineSubtotal > 0 ? Math.min(100, Math.max(0, discount / lineSubtotal * 100)) : 0;
  const persistedLines = lines.map((line) => {
    const amount = Number(line.subtotal);
    const discountAmount = Number(line.discountAmount ?? "0");
    const netAmount = Math.max(0, amount - discountAmount);
    const taxRate = Number(line.taxRate ?? "0");
    const taxAmount = Number(line.taxAmount ?? "0");
    const total = Number(line.total ?? String(netAmount + taxAmount));
    return { amount, discountAmount, netAmount, taxRate, taxAmount, total, taxable: taxRate > 0, persisted: line.discountAmount !== undefined && line.taxRate !== undefined && line.taxAmount !== undefined && line.total !== undefined };
  });
  const hasPersistedTotals = header.total !== undefined && persistedLines.every((line) => line.persisted);

  return {
    id: header.id,
    number: header.number,
    committed: header.status !== "draft",
    issueDate: dateOnly(issueDate),
    dueDate: dateOnly(dueDate),
    customerName: header.clientName,
    customerRut: header.clientTaxId ?? "",
    customerEmail: header.clientEmail,
    serviceType: "custom",
    invoice: Number(header.taxTotal) > 0,
    discountPercent,
    discountReason: header.discountReason ?? (discount > 0 ? "Descuento aplicado a la orden" : ""),
    ...(hasPersistedTotals ? { subtotal: Number(header.subtotal), discountTotal: discount, taxTotal: Number(header.taxTotal), total: Number(header.total) } : {}),
    items: lines.map((line, index) => ({
      id: line.id,
      name: line.description,
      description: `${line.code ? `${line.code} · ` : ""}Cantidad: ${Number(line.quantity).toLocaleString("es-CL", { maximumFractionDigits: 3 })}`,
      amount: persistedLines[index]!.amount,
      ...(persistedLines[index]!.persisted ? { discountAmount: persistedLines[index]!.discountAmount, netAmount: persistedLines[index]!.netAmount, taxRate: persistedLines[index]!.taxRate, taxAmount: persistedLines[index]!.taxAmount, total: persistedLines[index]!.total, taxable: persistedLines[index]!.taxable } : {}),
    })),
    createdAt: header.createdAt.toISOString(),
  };
}

export async function createOrderPdfResponse(order: PaymentOrder): Promise<Response> {
  const body = await createOrderPdfBytes(order);
  const responseBody = new ArrayBuffer(body.byteLength);
  new Uint8Array(responseBody).set(body);
  const filename = `orden-pago-${order.number.replace(/[^A-Za-z0-9_-]/g, "-")}.pdf`;
  return new Response(responseBody, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function createOrderPdfBytes(order: PaymentOrder): Promise<Uint8Array> {
  const logo = await readFile(resolve(process.cwd(), "public", "intelly-logo.png"));
  const logoDataUrl = `data:image/png;base64,${logo.toString("base64")}`;
  const pdf = buildOrderPdf({ order, settings: INTELLY_PDF_SETTINGS, logoDataUrl });
  return new Uint8Array(pdf.output("arraybuffer"));
}
