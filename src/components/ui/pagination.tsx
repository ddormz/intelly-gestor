import Link from "next/link";
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
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const previousDisabled = currentPage <= 1;
  const nextDisabled = currentPage >= totalPages;

  return <nav aria-label="Paginación" className="pagination flex flex-wrap items-center justify-between gap-3">
    <p className="text-sm text-[var(--color-muted-foreground)]">Página <strong className="text-[var(--brand-deep)]">{currentPage}</strong> de {totalPages} · {total} resultados</p>
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-semibold text-[var(--color-muted-foreground)]">Filas</span>
      {PAGE_SIZES.map((size) => {
        const href = pageSizeHref(query, size);
        const isActive = pageSize === size;
        return <Link
          key={size}
          href={href}
          scroll={false}
          aria-current={isActive ? "page" : undefined}
          className={`rounded-lg px-2.5 py-1 text-sm font-bold transition-colors ${isActive ? "bg-[var(--brand-royal)] text-white shadow-sm ring-1 ring-[var(--brand-blue)]" : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--brand-deep)]"}`}
        >{size}</Link>;
      })}
      <IconButton
        href={previousDisabled ? pageHref(query, currentPage) : pageHref(query, currentPage - 1)}
        label="Página anterior"
        icon={<ChevronLeft size={18} />}
        disabled={previousDisabled}
        className="!h-9 !min-h-9 !w-9 !min-w-9 !p-0"
      />
      <IconButton
        href={nextDisabled ? pageHref(query, currentPage) : pageHref(query, currentPage + 1)}
        label="Página siguiente"
        icon={<ChevronRight size={18} />}
        disabled={nextDisabled}
        className="!h-9 !min-h-9 !w-9 !min-w-9 !p-0"
      />
    </div>
  </nav>;
}
