"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Boxes, CreditCard, FileText, Gauge, Menu, PlugZap, Users, X, LogOut, PanelLeftClose } from "lucide-react";
import { logoutAction } from "@/features/auth/actions";

const links = [
  { href: "/", label: "Dashboard", icon: Gauge },
  { href: "/productos-servicios", label: "Productos o Servicios", icon: Boxes },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/ordenes", label: "Órdenes de Pago", icon: CreditCard },
  { href: "/facturacion", label: "Facturación", icon: FileText },
  { href: "/integraciones", label: "Integraciones", icon: PlugZap },
];

export function AppShell({ user, children }: { user: { name: string; role: string }; children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const nav = <>
    <div className="flex h-17 items-center gap-3 border-b border-white/10 px-4">
      <div className="grid size-9 place-items-center rounded-xl bg-emerald-500 font-bold text-white">IG</div>
      <div><p className="font-bold text-white">Intelly Gestor</p><p className="text-xs text-slate-300">Gestión y facturación</p></div>
    </div>
    <nav aria-label="Navegación principal" className="flex-1 space-y-1 p-3">
      {links.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${active ? "bg-white text-slate-900 shadow-sm" : "text-slate-200 hover:bg-white/10 hover:text-white"}`}>
          <Icon aria-hidden="true" size={19} strokeWidth={1.8} /><span>{label}</span>
        </Link>;
      })}
    </nav>
    <div className="border-t border-white/10 p-3">
      <div className="mb-3 px-2"><p className="truncate text-sm font-semibold text-white">{user.name}</p><p className="text-xs capitalize text-slate-300">{user.role}</p></div>
      <form action={logoutAction}><button className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-200 hover:bg-white/10 hover:text-white"><LogOut size={18} aria-hidden="true" />Cerrar sesión</button></form>
    </div>
  </>;

  return <div className="min-h-screen lg:grid lg:grid-cols-[272px_1fr]">
    <a className="skip-link" href="#contenido-principal">Ir al contenido principal</a>
    <aside className="hidden min-h-screen bg-[#142b48] lg:flex lg:flex-col">{nav}</aside>
    {open ? <div className="fixed inset-0 z-50 lg:hidden"><button aria-label="Cerrar menú" className="absolute inset-0 bg-slate-950/55" onClick={() => setOpen(false)} /><aside className="relative flex h-full w-[min(88vw,320px)] flex-col bg-[#142b48] shadow-2xl"><button aria-label="Cerrar menú" onClick={() => setOpen(false)} className="absolute right-3 top-3 grid size-11 place-items-center rounded-lg text-white hover:bg-white/10"><X /></button>{nav}</aside></div> : null}
    <div className="min-w-0">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:px-7">
        <button aria-label="Abrir menú" aria-expanded={open} onClick={() => setOpen(true)} className="grid size-11 place-items-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 lg:hidden"><Menu /></button>
        <div className="hidden items-center gap-2 text-sm font-semibold text-slate-500 lg:flex"><PanelLeftClose size={18} />Panel de gestión</div>
        <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">Operación segura</span>
      </header>
      <main id="contenido-principal" tabIndex={-1} className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  </div>;
}
