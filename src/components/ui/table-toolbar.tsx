import type { ReactNode } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { IconButton } from "./icon-button";
import { withPageQuery, type QueryInput } from "@/lib/list-query";

export type TableFilter = {
  name: string;
  label: string;
  options: Array<{ value: string; label: string }>;
};

export type TableTab = { value: string; label: string };

type TableToolbarProps = {
  query: QueryInput;
  filters?: TableFilter[];
  tabs?: TableTab[];
  action?: ReactNode;
};

function queryHref(query: QueryInput, patch: QueryInput): string {
  const params = new URLSearchParams(withPageQuery(query, patch));
  const search = params.toString();
  return search ? `?${search}` : "?";
}

function HiddenQuery({ query }: { query: QueryInput }) {
  return <>{Object.entries(query).map(([key, value]) => {
    if (key === "q" || key === "page") return null;
    const normalized = Array.isArray(value) ? value[0] : value;
    return normalized !== undefined && normalized !== "" ? <input key={key} type="hidden" name={key} value={String(normalized)} /> : null;
  })}<input type="hidden" name="page" value="1" /></>;
}

export function TableToolbar({ query, filters = [], tabs = [], action }: TableToolbarProps) {
  const currentTab = query.tab ?? tabs[0]?.value;
  return <div className="table-toolbar grid gap-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <form method="get" className="flex min-w-0 flex-1 flex-wrap items-end gap-2" role="search">
        <div className="min-w-[min(100%,18rem)] flex-1">
          <label htmlFor="table-search" className="mb-1.5 block text-sm font-semibold text-[var(--brand-deep)]">Buscar</label>
          <input id="table-search" name="q" defaultValue={typeof query.q === "string" ? query.q : ""} className="field" placeholder="Buscar por nombre, código o correo" />
        </div>
        <HiddenQuery query={query} />
        <IconButton type="submit" label="Buscar" icon={<Search size={18} />} variant="primary" />
        {query.q ? <IconButton href={queryHref(query, { q: "", page: "1" })} label="Limpiar búsqueda" icon={<X size={18} />} /> : null}
      </form>
      {action ? <div className="page-header-action">{action}</div> : null}
    </div>
    {filters.length ? <div className="flex flex-wrap items-end gap-4">
      {filters.map((filter) => <div key={filter.name} className="grid gap-1.5">
        <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted-foreground)]">{filter.label}</span>
        <div className="flex flex-wrap gap-2">
          {filter.options.map((option) => {
            const href = queryHref(query, { [filter.name]: option.value, page: "1" });
            const isSelected = query[filter.name] === option.value || (!query[filter.name] && !option.value);
            return <Link
              key={option.value || "all"}
              href={href}
              scroll={false}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${isSelected ? "border-[var(--brand-blue)] bg-[rgb(47_167_255_/_0.15)] text-[var(--brand-navy)] font-bold shadow-xs" : "border-[var(--color-border)] bg-white text-[var(--color-muted-foreground)] hover:border-[var(--brand-blue)] hover:text-[var(--brand-deep)]"}`}
            >{option.label}</Link>;
          })}
        </div>
      </div>)}
    </div> : null}
    {tabs.length ? <div role="tablist" aria-label="Vistas de la lista" className="table-tabs flex flex-wrap gap-1 border-b border-[var(--color-border)]">
      {tabs.map((tab) => {
        const href = queryHref(query, { tab: tab.value, page: "1" });
        const isActive = currentTab === tab.value;
        return <Link
          key={tab.value}
          role="tab"
          aria-selected={isActive}
          href={href}
          scroll={false}
          className={`border-b-2 px-3 py-2 text-sm font-bold transition-colors ${isActive ? "border-[var(--brand-royal)] text-[var(--brand-royal)]" : "border-transparent text-[var(--color-muted-foreground)] hover:text-[var(--brand-navy)] hover:border-[var(--color-border-strong)]"}`}
        >{tab.label}</Link>;
      })}
    </div> : null}
  </div>;
}
