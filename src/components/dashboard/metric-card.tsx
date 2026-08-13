import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui";

export function MetricCard({ label, value, note, icon: Icon, tone = "navy" }: { label: string; value: string; note: string; icon: LucideIcon; tone?: "navy" | "green" | "blue" | "amber" }) {
  const colors = { navy: "bg-slate-100 text-slate-700", green: "bg-emerald-50 text-emerald-700", blue: "bg-blue-50 text-blue-700", amber: "bg-amber-50 text-amber-700" };
  return <Card><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-slate-600">{label}</p><p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-500">{note}</p></div><div className={`grid size-11 shrink-0 place-items-center rounded-xl ${colors[tone]}`}><Icon aria-hidden="true" size={21} /></div></div></Card>;
}
