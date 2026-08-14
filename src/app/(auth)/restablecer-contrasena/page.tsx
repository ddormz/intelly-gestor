import { BrandLogo } from "@/components/brand/brand-logo";
import { Card } from "@/components/ui";
import { ResetForm } from "./reset-form";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return <main className="grid min-h-screen place-items-center p-5 sm:p-10"><div className="w-full max-w-lg"><BrandLogo priority className="mx-auto mb-8"/><Card className="brand-card"><p className="page-eyebrow">Acceso seguro</p><h1 className="page-title">Crea una nueva contraseña</h1><p className="page-copy">Al guardar, cerraremos todas las sesiones anteriores de la cuenta.</p><div className="mt-7"><ResetForm token={token} /></div></Card></div></main>;
}
