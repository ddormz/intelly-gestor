import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui";

export function MetricCard({ label, value, note, icon: Icon, tone = "navy" }: { label: string; value: string; note: string; icon: LucideIcon; tone?: "navy" | "green" | "blue" | "amber" }) {
  const colors = { navy: "bg-[rgb(15_42_107_/_0.08)] text-[var(--brand-navy)]", green: "bg-[rgb(18_128_92_/_0.08)] text-[var(--color-success)]", blue: "bg-[rgb(47_167_255_/_0.1)] text-[var(--brand-royal)]", amber: "bg-[rgb(178_94_9_/_0.08)] text-[var(--color-warning)]" };
  return <Card className="brand-card"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-[var(--color-muted-foreground)]">{label}</p><p className="mt-2 text-2xl font-bold tracking-tight text-[var(--brand-deep)]">{value}</p><p className="mt-1 text-xs text-[var(--color-muted-foreground)]">{note}</p></div><div className={`grid size-11 shrink-0 place-items-center rounded-xl ${colors[tone]}`}><Icon aria-hidden="true" size={21} /></div></div></Card>;
}
