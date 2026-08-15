import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "./icon-button";
import { PAGE_SIZES, withPageQuery, type QueryInput } from "@/lib/list-query";

type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  query: QueryInput;
};

function pageHref(query: QueryInput, page: number): string {
  const params = new URLSearchParams(withPageQuery(query, { page: String(page) }));
  return `?${params.toString()}`;
}

function pageSizeHref(query: QueryInput, pageSize: number): string {
  const params = new URLSearchParams(withPageQuery(query, { page: "1", pageSize: String(pageSize) }));
  return `?${params.toString()}`;
}

export function Pagination({ page, pageSize, total, query }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const previousDisabled = page <= 1;
  const nextDisabled = page >= totalPages;
  return <nav aria-label="Paginación" className="pagination flex flex-wrap items-center justify-between gap-3">
    <p className="text-sm text-[var(--color-muted-foreground)]">Página <strong className="text-[var(--brand-deep)]">{Math.min(page, totalPages)}</strong> de {totalPages} · {total} resultados</p>
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-semibold text-[var(--color-muted-foreground)]">Filas</span>
      {PAGE_SIZES.map((size) => <a key={size} href={pageSizeHref(query, size)} aria-current={pageSize === size ? "page" : undefined} className={`rounded-md px-2 py-1 text-sm font-semibold ${pageSize === size ? "bg-[var(--brand-navy)] text-white" : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]"}`}>{size}</a>)}
      <IconButton href={previousDisabled ? pageHref(query, page) : pageHref(query, page - 1)} label="Página anterior" icon={<ChevronLeft size={18} />} disabled={previousDisabled} className="!h-10 !min-h-10 !w-10 !p-0" />
      <IconButton href={nextDisabled ? pageHref(query, page) : pageHref(query, page + 1)} label="Página siguiente" icon={<ChevronRight size={18} />} disabled={nextDisabled} className="!h-10 !min-h-10 !w-10 !p-0" />
    </div>
  </nav>;
}
