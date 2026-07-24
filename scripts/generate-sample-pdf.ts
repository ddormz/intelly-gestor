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
  companyName: "Intelly SpA",
  companyRut: "76.000.000-0",
  businessLine: "Servicios de tecnología y soluciones digitales",
  address: "Santiago, Chile",
  email: "contacto@intelly.cl",
  phone: "+56 9 0000 0000",
  bankName: "Banco de ejemplo",
  accountType: "Cuenta corriente",
  accountNumber: "0000000000",
  accountHolder: "Intelly SpA",
  accountRut: "76.000.000-0",
  transferEmail: "pagos@intelly.cl",
  paymentTerms:
    "La activación o renovación del servicio se realizará una vez confirmado el pago. Esta orden tiene vigencia hasta su fecha de vencimiento.",
  paymentInstructions:
    "Incluye el número de orden OP-2026-0001 en el comentario de la transferencia.",
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
  items: [
    {
      id: "item-1",
      name: "Hosting Business",
      description:
        "Alojamiento web administrado para cliente.cl · período anual · respaldos diarios y certificado SSL.",
      amount: 120000,
    },
    {
      id: "item-2",
      name: "Migración asistida",
      description:
        "Migración inicial del sitio, base de datos y cuentas de correo.",
      amount: 35000,
    },
  ],
};

const logoDataUrl = `data:image/png;base64,${readFileSync(logoPath).toString("base64")}`;
const pdf = buildOrderPdf({ order, settings, logoDataUrl });
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
