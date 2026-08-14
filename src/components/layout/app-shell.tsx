"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Boxes, CircleUserRound, CreditCard, FileText, Gauge, LogOut, Menu, PanelLeftClose, PlugZap, ShieldCheck, Users, X } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { SubmitButton } from "@/components/ui";
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

  const navigation = <>
    <div className="flex min-h-24 items-center border-b border-[var(--color-border)] px-5">
      <BrandLogo priority className="h-auto w-[150px] py-3" />
    </div>
    <div className="px-5 pt-5"><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[var(--brand-cyan)]">Gestión comercial</p></div>
    <nav aria-label="Navegación principal" className="flex-1 space-y-1.5 p-3">
      {links.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined} className={`group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${active ? "bg-[rgb(20_208_246_/_0.14)] text-[var(--brand-navy)] shadow-[inset_3px_0_0_var(--brand-cyan)]" : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-background-soft)] hover:text-[var(--brand-navy)]"}`}>
          <Icon aria-hidden="true" size={19} strokeWidth={active ? 2.2 : 1.8} className={active ? "text-[var(--brand-blue)]" : "text-[var(--color-muted-foreground)] group-hover:text-[var(--brand-blue)]"} />
          <span>{label}</span>
        </Link>;
      })}
    </nav>
    <div className="border-t border-[var(--color-border)] p-3">
      <div className="mb-3 flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-background-soft)] p-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[rgb(20_208_246_/_0.14)] text-[var(--brand-navy)]"><CircleUserRound size={20} /></div>
        <div className="min-w-0"><p className="truncate text-sm font-semibold text-[var(--brand-deep)]">{user.name}</p><p className="text-xs capitalize text-[var(--color-muted-foreground)]">{user.role}</p></div>
      </div>
      <form action={logoutAction}><SubmitButton variant="secondary" className="w-full !justify-start" pendingLabel="Cerrando sesión…"><LogOut size={18} aria-hidden="true" />Cerrar sesión</SubmitButton></form>
    </div>
  </>;

  return <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
    <a className="skip-link" href="#contenido-principal">Ir al contenido principal</a>
    <aside className="shell-sidebar hidden min-h-screen lg:flex lg:flex-col">{navigation}</aside>
    {open ? <div className="fixed inset-0 z-50 lg:hidden">
      <button aria-label="Cerrar menú" className="absolute inset-0 bg-[var(--brand-deep)]/65 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <aside className="shell-sidebar relative flex h-full w-[min(88vw,320px)] flex-col shadow-2xl">
        <button aria-label="Cerrar menú" onClick={() => setOpen(false)} className="absolute right-3 top-3 z-10 grid size-11 place-items-center rounded-xl text-[var(--brand-navy)] hover:bg-[var(--color-muted)]"><X /></button>
        {navigation}
      </aside>
    </div> : null}
    <div className="shell-main">
      <header className="shell-topbar sticky top-0 z-30 flex h-17 items-center justify-between px-4 lg:px-8">
        <button aria-label="Abrir menú" aria-expanded={open} onClick={() => setOpen(true)} className="grid size-11 place-items-center rounded-xl border border-[var(--color-border)] bg-white text-[var(--brand-navy)] shadow-sm hover:border-[var(--brand-blue)] lg:hidden"><Menu /></button>
        <div className="hidden items-center gap-2 text-sm font-semibold text-[var(--color-muted-foreground)] lg:flex"><PanelLeftClose size={18} />Panel de gestión</div>
        <span className="safe-pill"><ShieldCheck size={14} aria-hidden="true" />Operación segura</span>
      </header>
      <main id="contenido-principal" tabIndex={-1} className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  </div>;
}
