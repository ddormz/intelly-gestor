import { BrandLogo } from "@/components/brand/brand-logo";
import { Card } from "@/components/ui";
import { RecoveryForm } from "./recovery-form";

export default function RecoverPasswordPage() {
  return <main className="grid min-h-screen place-items-center p-5 sm:p-10"><div className="w-full max-w-lg"><BrandLogo priority className="mx-auto mb-8"/><Card className="brand-card"><p className="page-eyebrow">Acceso seguro</p><h1 className="page-title">Recupera tu contraseña</h1><p className="page-copy">Te enviaremos un enlace de un solo uso que vence en 30 minutos.</p><div className="mt-7"><RecoveryForm /></div></Card></div></main>;
}
