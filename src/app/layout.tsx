import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://gestion.intelly.cl"),
  title: { default: "Intelly Gestor", template: "%s · Intelly Gestor" },
  description: "Gestión segura de clientes, órdenes de pago y facturación electrónica.",
  icons: { icon: "/intelly-isotipo.png", apple: "/intelly-isotipo.png" },
  openGraph: { title: "Intelly Gestor", description: "Gestión comercial, órdenes de pago y facturación conectada.", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
