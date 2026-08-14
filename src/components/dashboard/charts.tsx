"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatClpAmount } from "@/lib/money";

export function RevenueChart({ data }: { data: Array<{ label: string; total: number }> }) {
  if (!data.length) return <div className="grid h-64 place-items-center rounded-xl bg-[var(--color-background-soft)] text-sm text-[var(--color-muted-foreground)]">La tendencia aparecerá cuando existan cobros.</div>;
  return <div>
    <div className="h-64" aria-hidden="true"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ left: 0, right: 12, top: 16, bottom: 0 }}><CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={(value) => `$${Math.round(Number(value) / 1000)}k`} /><Tooltip formatter={(value) => [formatClpAmount(Number(value)), "Cobrado"]} /><Line type="monotone" dataKey="total" stroke="#1b4be0" strokeWidth={3} dot={{ fill: "#14d0f6", stroke: "#1b4be0", strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} /></LineChart></ResponsiveContainer></div>
    <details className="mt-2 text-sm"><summary className="font-semibold text-[var(--brand-royal)]">Ver datos de la tendencia</summary><table className="mt-2 w-full"><thead><tr><th className="text-left">Fecha</th><th className="text-right">Cobrado</th></tr></thead><tbody>{data.map((item) => <tr key={item.label}><td>{item.label}</td><td className="text-right">{formatClpAmount(item.total)}</td></tr>)}</tbody></table></details>
  </div>;
}
