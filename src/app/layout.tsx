import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Intelly Gestor", template: "%s · Intelly Gestor" },
  description: "Gestión segura de clientes, órdenes de pago y facturación electrónica.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
