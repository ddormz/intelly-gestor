"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function RevenueChart({ data }: { data: Array<{ label: string; total: number }> }) {
  if (!data.length) return <div className="grid h-64 place-items-center rounded-xl bg-slate-50 text-sm text-slate-500">La tendencia aparecerá cuando existan cobros.</div>;
  return <div>
    <div className="h-64" aria-hidden="true"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ left: 0, right: 12, top: 16, bottom: 0 }}><CartesianGrid stroke="#e4e7eb" strokeDasharray="4 4" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 12, fill: "#526071" }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 12, fill: "#526071" }} axisLine={false} tickLine={false} tickFormatter={(value) => `$${Math.round(Number(value) / 1000)}k`} /><Tooltip formatter={(value) => [new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(Number(value)), "Cobrado"]} /><Line type="monotone" dataKey="total" stroke="#047857" strokeWidth={3} dot={{ fill: "#047857", r: 3 }} activeDot={{ r: 5 }} /></LineChart></ResponsiveContainer></div>
    <details className="mt-2 text-sm"><summary className="font-semibold text-blue-700">Ver datos de la tendencia</summary><table className="mt-2 w-full"><thead><tr><th className="text-left">Fecha</th><th className="text-right">Cobrado</th></tr></thead><tbody>{data.map((item) => <tr key={item.label}><td>{item.label}</td><td className="text-right">{item.total.toLocaleString("es-CL")}</td></tr>)}</tbody></table></details>
  </div>;
}
