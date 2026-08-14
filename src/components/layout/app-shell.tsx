"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Boxes, CircleUserRound, CreditCard, FileText, Gauge, LogOut, Menu, PanelLeftClose, PanelLeftOpen, PlugZap, Users, X } from "lucide-react";
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
  { href: "/usuarios", label: "Usuarios", icon: CircleUserRound, adminOnly: true },
] as const;

export function getNavigationLinks(role: string) {
  return links.filter((link) => !("adminOnly" in link && link.adminOnly) || role === "admin");
}

export function AppShell({ user, children }: { user: { name: string; role: string }; children: React.ReactNode }) {
  const path = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem("intelly-sidebar-collapsed") === "true");
  }, []);

  function toggleSidebar() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("intelly-sidebar-collapsed", String(next));
      return next;
    });
  }

  const navigation = (compact: boolean) => <>
    <div className={`flex min-h-24 items-center border-b border-[var(--color-border)] ${compact ? "justify-center px-2" : "px-5"}`}>
      <BrandLogo priority variant={compact ? "mark" : "full"} className={compact ? "size-11" : "h-auto w-[150px] py-3"} />
    </div>
    {!compact ? <div className="px-5 pt-5"><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[var(--brand-cyan)]">Gestión comercial</p></div> : null}
    <nav aria-label="Navegación principal" className="flex-1 space-y-1.5 p-3">
      {getNavigationLinks(user.role).map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return <Link key={href} href={href} title={compact ? label : undefined} onClick={() => setMobileOpen(false)} aria-current={active ? "page" : undefined} className={`group flex min-h-11 items-center rounded-xl text-sm font-semibold ${compact ? "justify-center px-2" : "gap-3 px-3"} ${active ? "bg-[rgb(20_208_246_/_0.14)] text-[var(--brand-navy)] shadow-[inset_3px_0_0_var(--brand-cyan)]" : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-background-soft)] hover:text-[var(--brand-navy)]"}`}>
          <Icon aria-hidden="true" size={20} strokeWidth={active ? 2.2 : 1.8} className={active ? "text-[var(--brand-blue)]" : "text-[var(--color-muted-foreground)] group-hover:text-[var(--brand-blue)]"} />
          <span className={compact ? "sr-only" : ""}>{label}</span>
        </Link>;
      })}
    </nav>
    <div className="border-t border-[var(--color-border)] p-3">
      <div className={`mb-2 flex items-center rounded-xl bg-[var(--color-background-soft)] ${compact ? "justify-center p-2" : "gap-3 p-3"}`} title={compact ? `${user.name} · ${user.role}` : undefined}>
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[rgb(20_208_246_/_0.14)] text-[var(--brand-navy)]"><CircleUserRound size={20} /></div>
        {!compact ? <div className="min-w-0"><p className="truncate text-sm font-semibold text-[var(--brand-deep)]">{user.name}</p><p className="text-xs capitalize text-[var(--color-muted-foreground)]">{user.role}</p></div> : null}
      </div>
      <form action={logoutAction} className={compact ? "flex justify-center" : ""}>
        <SubmitButton variant="secondary" className={compact ? "!min-h-9 !w-9 !p-0" : "!min-h-9 w-full !justify-start !px-2.5 !py-1.5"} pendingLabel={compact ? "…" : "Cerrando sesión…"}>
          <LogOut size={17} aria-hidden="true" /><span className={compact ? "sr-only" : ""}>Cerrar sesión</span>
        </SubmitButton>
      </form>
    </div>
  </>;

  return <div className={`min-h-screen lg:grid ${collapsed ? "lg:grid-cols-[76px_1fr]" : "lg:grid-cols-[260px_1fr]"}`}>
    <a className="skip-link" href="#contenido-principal">Ir al contenido principal</a>
    <aside className="shell-sidebar hidden min-h-screen lg:flex lg:flex-col">{navigation(collapsed)}</aside>
    {mobileOpen ? <div className="fixed inset-0 z-50 lg:hidden">
      <button aria-label="Cerrar menú" className="absolute inset-0 bg-[var(--brand-deep)]/65 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
      <aside className="shell-sidebar relative flex h-full w-[min(88vw,320px)] flex-col shadow-2xl">
        <button aria-label="Cerrar menú" onClick={() => setMobileOpen(false)} className="absolute right-3 top-3 z-10 grid size-11 place-items-center rounded-xl text-[var(--brand-navy)] hover:bg-[var(--color-muted)]"><X /></button>
        {navigation(false)}
      </aside>
    </div> : null}
    <div className="shell-main">
      <header className="shell-topbar sticky top-0 z-30 flex h-17 items-center px-4 lg:px-8">
        <button aria-label="Abrir menú" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)} className="grid size-11 place-items-center rounded-xl border border-[var(--color-border)] bg-white text-[var(--brand-navy)] shadow-sm hover:border-[var(--brand-blue)] lg:hidden"><Menu /></button>
        <button aria-label={collapsed ? "Expandir navegación" : "Colapsar navegación"} aria-expanded={!collapsed} onClick={toggleSidebar} className="hidden size-10 place-items-center rounded-xl border border-[var(--color-border)] bg-white text-[var(--brand-navy)] shadow-sm hover:border-[var(--brand-blue)] lg:grid">
          {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
        </button>
      </header>
      <main id="contenido-principal" tabIndex={-1} className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  </div>;
}
