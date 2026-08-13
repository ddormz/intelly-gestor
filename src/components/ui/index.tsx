import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`surface rounded-2xl p-5 ${className}`}>{children}</section>;
}

export function Button({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`btn-primary disabled:cursor-not-allowed disabled:opacity-55 ${className}`} {...props} />;
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="field" {...props} />;
}

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-semibold text-slate-800">
    <span>{label}</span>{children}
    {hint ? <span className="font-normal text-slate-500">{hint}</span> : null}
    {error ? <span role="alert" className="font-normal text-red-700">{error}</span> : null}
  </label>;
}

const badgeStyle: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-800 border-emerald-200",
  invoiced: "bg-blue-50 text-blue-800 border-blue-200",
  issued: "bg-indigo-50 text-indigo-800 border-indigo-200",
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  draft: "bg-slate-100 text-slate-700 border-slate-200",
  rejected: "bg-red-50 text-red-800 border-red-200",
};

export function Badge({ status, children }: { status: string; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${badgeStyle[status] ?? badgeStyle.draft}`}>{children}</span>;
}

export function EmptyState({ title, copy, action }: { title: string; copy: string; action?: ReactNode }) {
  return <div className="grid min-h-52 place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
    <div><h2 className="text-lg font-bold text-slate-900">{title}</h2><p className="mt-2 max-w-md text-sm text-slate-600">{copy}</p>{action ? <div className="mt-4">{action}</div> : null}</div>
  </div>;
}

export function Alert({ children, tone = "error" }: { children: ReactNode; tone?: "error" | "info" | "success" }) {
  const style = tone === "error" ? "border-red-200 bg-red-50 text-red-800" : tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-blue-200 bg-blue-50 text-blue-800";
  return <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl border p-3 text-sm ${style}`}>{children}</div>;
}
