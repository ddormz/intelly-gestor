import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return <main className="grid min-h-screen lg:grid-cols-[1.08fr_.92fr]">
    <section className="login-hero hidden p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
      <BrandLogo priority className="h-auto w-[180px]" />
      <div className="max-w-xl">
        <p className="mb-5 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.18em] text-[var(--brand-cyan)]"><Sparkles size={16} />Control comercial conectado</p>
        <h2 className="text-5xl font-bold leading-[1.08] text-[var(--brand-deep)] xl:text-6xl">Gestión simple.<br />Cobros inteligentes.</h2>
        <p className="mt-6 max-w-lg text-lg text-[var(--color-muted-foreground)]">De la orden de pago a la factura, con tus clientes, documentos y estadísticas siempre bajo control.</p>
        <ul className="mt-8 grid gap-3 text-sm text-[var(--brand-navy)]"><li className="flex items-center gap-2"><CheckCircle2 size={17} className="text-[var(--brand-blue)]" />Órdenes trazables y enlaces seguros</li><li className="flex items-center gap-2"><CheckCircle2 size={17} className="text-[var(--brand-blue)]" />Facturación conectada con IntellyDTE</li></ul>
      </div>
      <p className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]"><ShieldCheck size={16} />Acceso exclusivo para personal autorizado.</p>
    </section>
    <section className="flex items-center justify-center p-5 sm:p-10">
      <div className="w-full max-w-md">
        <div className="mb-9 lg:hidden"><BrandLogo priority /></div>
        <div className="mb-7 grid size-12 place-items-center rounded-2xl bg-[rgb(47_167_255_/_0.1)] text-[var(--brand-royal)]"><ArrowRight size={24} /></div>
        <h1 className="page-title">Bienvenido de vuelta</h1><p className="page-copy mt-2">Ingresa con tu cuenta de Intelly Gestor.</p>
        <div className="mt-8"><LoginForm /></div>
        <p className="mt-8 border-t border-[var(--color-border)] pt-5 text-xs text-[var(--color-muted-foreground)]">Tu sesión se protege con expiración por inactividad y puede ser revocada por un administrador.</p>
      </div>
    </section>
  </main>;
}
