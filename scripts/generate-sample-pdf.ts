import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildOrderPdf,
  CompanySettings,
  PaymentOrder,
} from "../lib/order-pdf";

const root = resolve(import.meta.dirname, "..");
const logoPath = resolve(root, "public", "intelly-logo.png");
const outputDir = resolve(root, "output", "pdf");
const outputPath = resolve(outputDir, "orden-pago-muestra.pdf");
const longOutputPath = resolve(outputDir, "orden-pago-muestra-larga.pdf");

const settings: CompanySettings = {
  companyName: "INTELLY SPA",
  companyRut: "78.202.703-4",
  businessLine: "Servicios de tecnología y soluciones digitales",
  address: "Santiago, Chile",
  email: "dramirez@intelly.cl",
  phone: "+56 9 0000 0000",
  bankName: "Banco de Chile",
  accountType: "Cuenta Corriente",
  accountNumber: "00-171-21318-01",
  accountHolder: "INTELLY SPA",
  accountRut: "78.202.703-4",
  transferEmail: "dramirez@intelly.cl",
  paymentTerms:
    "Posterior al vencimiento de esta orden de pago, se procederá con el corte del servicio.",
  paymentInstructions:
    "Para poder reestablecer el servicio, tendrá un cargo asociado adicional.\nIndicar Referencia al pago el número de orden.",
  dueDays: 10,
};

const order: PaymentOrder = {
  id: "sample",
  number: "OP-2026-0001",
  committed: true,
  issueDate: "2026-07-24",
  dueDate: "2026-08-03",
  customerName: "Empresa Cliente SpA",
  customerRut: "77.111.222-3",
  customerEmail: "finanzas@cliente.cl",
  serviceType: "hosting",
  invoice: true,
  discountPercent: 20,
  discountReason: "Cliente preferente por antigüedad",
  items: [
    {
      id: "item-1",
      name: "Servicio de Hosting sitio-uno.cl",
      description: "Renovación de Hosting por un período anual.",
      amount: 50000,
    },
    {
      id: "item-2",
      name: "Servicio de Hosting sitio-dos.cl",
      description: "Renovación de Hosting por un período anual.",
      amount: 50000,
    },
  ],
};

const logoDataUrl = `data:image/png;base64,${readFileSync(logoPath).toString("base64")}`;
const pdf = buildOrderPdf({ order, settings, logoDataUrl });
if (pdf.getNumberOfPages() !== 1) {
  throw new Error("La orden compacta de validación debe caber en una página.");
}
mkdirSync(outputDir, { recursive: true });
writeFileSync(outputPath, Buffer.from(pdf.output("arraybuffer")));

const longOrder: PaymentOrder = {
  ...order,
  id: "sample-long",
  number: "OP-2026-0002",
  items: Array.from({ length: 18 }, (_, index) => ({
    id: `long-${index}`,
    name: `Servicio ${index + 1}`,
    description:
      "Descripción extensa del servicio, alcance mensual, soporte incluido y período de vigencia correspondiente.",
    amount: 15000 + index * 1000,
  })),
};
const longPdf = buildOrderPdf({
  order: longOrder,
  settings: {
    ...settings,
    paymentTerms: `${settings.paymentTerms} ${settings.paymentTerms} ${settings.paymentTerms}`,
  },
  logoDataUrl,
});
writeFileSync(longOutputPath, Buffer.from(longPdf.output("arraybuffer")));
console.log(outputPath);
console.log(longOutputPath);
