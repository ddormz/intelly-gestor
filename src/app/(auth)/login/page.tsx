import { ShieldCheck } from "lucide-react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return <main className="grid min-h-screen lg:grid-cols-[1.1fr_.9fr]">
    <section className="hidden bg-[#142b48] p-12 text-white lg:flex lg:flex-col lg:justify-between">
      <div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-xl bg-emerald-500 font-bold">IG</div><span className="text-xl font-bold">Intelly Gestor</span></div>
      <div className="max-w-xl"><p className="mb-4 text-sm font-bold uppercase tracking-[.18em] text-emerald-300">Control comercial conectado</p><h1 className="text-5xl font-bold leading-tight">De la orden de pago a la factura, sin perder el control.</h1><p className="mt-6 max-w-lg text-lg text-slate-300">Gestiona clientes, cobros y documentos tributarios con trazabilidad de punta a punta.</p></div>
      <p className="text-sm text-slate-400">Acceso exclusivo para personal autorizado.</p>
    </section>
    <section className="flex items-center justify-center p-5 sm:p-10">
      <div className="w-full max-w-md">
        <div className="mb-8 grid size-12 place-items-center rounded-2xl bg-blue-50 text-[#1e3a5f]"><ShieldCheck size={26} /></div>
        <h1 className="page-title">Bienvenido de vuelta</h1><p className="page-copy mt-2">Ingresa con tu cuenta de Intelly Gestor.</p>
        <div className="mt-8"><LoginForm /></div>
        <p className="mt-8 text-xs text-slate-500">Tu sesión se protege con expiración por inactividad y puede ser revocada por un administrador.</p>
      </div>
    </section>
  </main>;
}
