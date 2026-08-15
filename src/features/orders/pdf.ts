import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildOrderPdf, type CompanySettings, type PaymentOrder } from "../../../lib/order-pdf";

export type OrderPdfHeader = {
  id: string;
  number: string;
  status: string;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
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
    discountReason: discount > 0 ? "Descuento aplicado a la orden" : "",
    items: lines.map((line) => ({
      id: line.id,
      name: line.description,
      description: `${line.code ? `${line.code} · ` : ""}Cantidad: ${Number(line.quantity).toLocaleString("es-CL", { maximumFractionDigits: 3 })}`,
      amount: Number(line.subtotal),
    })),
    createdAt: header.createdAt.toISOString(),
  };
}

export async function createOrderPdfResponse(order: PaymentOrder): Promise<Response> {
  const logo = await readFile(resolve(process.cwd(), "public", "intelly-logo.png"));
  const logoDataUrl = `data:image/png;base64,${logo.toString("base64")}`;
  const pdf = buildOrderPdf({ order, settings: INTELLY_PDF_SETTINGS, logoDataUrl });
  const body = new Uint8Array(pdf.output("arraybuffer"));
  const filename = `orden-pago-${order.number.replace(/[^A-Za-z0-9_-]/g, "-")}.pdf`;
  return new Response(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
