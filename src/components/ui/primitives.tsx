import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { Inbox, LoaderCircle, TriangleAlert } from "lucide-react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`surface rounded-[var(--radius-lg)] p-5 sm:p-6 ${className}`}>{children}</section>;
}

export function FormPanel({ title, icon, children, className = "" }: { title: string; icon?: ReactNode; children: ReactNode; className?: string }) {
  return <Card className={`brand-card ${className}`}>
    <div className="mb-5 flex items-center gap-2.5 text-[var(--brand-navy)]">{icon}<h2 className="text-lg font-bold">{title}</h2></div>
    {children}
  </Card>;
}

export function Button({ className = "", variant = "primary", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  return <button className={`btn-${variant} ${className}`} {...props} />;
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`field ${className}`} {...props} />;
}

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-semibold text-[var(--brand-deep)]">
    <span>{label}</span>{children}
    {hint ? <span className="font-normal text-[var(--color-muted-foreground)]">{hint}</span> : null}
    {error ? <span role="alert" className="font-normal text-[var(--color-destructive)]">{error}</span> : null}
  </label>;
}

const badgeStyle: Record<string, string> = {
  active: "status-success", paid: "status-success", success: "status-success",
  invoiced: "status-info", issued: "status-info",
  pending: "status-warning", expired: "status-warning",
  draft: "status-neutral",
  cancelled: "status-danger", failed: "status-danger", rejected: "status-danger",
};

export function Badge({ status, children }: { status: string; children: ReactNode }) {
  return <span className={`status-badge ${badgeStyle[status] ?? "status-neutral"}`}>{children}</span>;
}

export function TableShell({ children, mobileCards = false }: { children: ReactNode; mobileCards?: boolean }) {
  return <div className="data-table-wrap"><div className="data-table-scroll"><table className={`data-table ${mobileCards ? "mobile-cards" : ""}`}>{children}</table></div></div>;
}

export function EmptyState({ title, copy, action }: { title: string; copy: string; action?: ReactNode }) {
  return <div className="grid min-h-52 place-items-center rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-background-soft)] p-8 text-center">
    <div><div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-[rgb(47_167_255_/_0.1)] text-[var(--brand-royal)]"><Inbox aria-hidden="true" size={23} /></div><h2 className="text-lg font-bold text-[var(--brand-deep)]">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm text-[var(--color-muted-foreground)]">{copy}</p>{action ? <div className="mt-5">{action}</div> : null}</div>
  </div>;
}

export function LoadingState({ label = "Cargando información…" }: { label?: string }) {
  return <div role="status" aria-live="polite" className="grid min-h-56 place-items-center text-center"><div><LoaderCircle aria-hidden="true" className="mx-auto animate-spin text-[var(--brand-blue)]" size={34} /><p className="mt-3 text-sm font-semibold text-[var(--color-muted-foreground)]">{label}</p></div></div>;
}

export function ErrorState({ title = "No pudimos cargar esta sección", copy, action }: { title?: string; copy: string; action?: ReactNode }) {
  return <div role="alert" className="grid min-h-60 place-items-center rounded-[var(--radius-lg)] border border-[rgb(193_50_50_/_0.22)] bg-[#fff8f8] p-8 text-center"><div><TriangleAlert aria-hidden="true" className="mx-auto text-[var(--color-destructive)]" size={34} /><h1 className="mt-4 text-xl font-bold text-[var(--color-destructive)]">{title}</h1><p className="mt-2 text-sm text-[#8f2d2d]">{copy}</p>{action ? <div className="mt-5">{action}</div> : null}</div></div>;
}

export function Alert({ children, tone = "error" }: { children: ReactNode; tone?: "error" | "info" | "success" }) {
  const style = tone === "error" ? "border-[rgb(193_50_50_/_0.22)] bg-[#fff7f7] text-[var(--color-destructive)]" : tone === "success" ? "border-[rgb(18_128_92_/_0.22)] bg-[#f2fbf7] text-[var(--color-success)]" : "border-[rgb(27_75_224_/_0.2)] bg-[#f3f6ff] text-[var(--brand-royal)]";
  return <div role={tone === "error" ? "alert" : "status"} aria-live="polite" className={`rounded-[var(--radius-sm)] border p-3.5 text-sm ${style}`}>{children}</div>;
}
