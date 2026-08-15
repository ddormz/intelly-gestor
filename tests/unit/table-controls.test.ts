import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Pagination } from "@/components/ui/pagination";
import { TableToolbar } from "@/components/ui/table-toolbar";

describe("table controls", () => {
  it("preserves unrelated parameters in the search form", () => {
    const markup = renderToStaticMarkup(createElement(TableToolbar, {
      query: { q: "cliente", status: "active", page: "3" },
      filters: [],
    }));

    expect(markup).toContain('name="q"');
    expect(markup).toContain('name="status" value="active"');
    expect(markup).toContain('name="page" value="1"');
  });

  it("sets page one on filter changes and exposes the active tab", () => {
    const markup = renderToStaticMarkup(createElement(TableToolbar, {
      query: { q: "cliente", status: "active", page: "4" },
      filters: [{ name: "status", label: "Estado", options: [{ value: "active", label: "Activo" }, { value: "inactive", label: "Inactivo" }] }],
      tabs: [{ value: "active", label: "Activos" }, { value: "all", label: "Todos" }],
    }));

    expect(markup).toContain("status=inactive");
    expect(markup).toContain("page=1");
    expect(markup).toContain('aria-selected="true"');
  });

  it("disables previous and next links at pagination boundaries", () => {
    const firstPage = renderToStaticMarkup(createElement(Pagination, { page: 1, pageSize: 25, total: 30, query: { status: "active" } }));
    const lastPage = renderToStaticMarkup(createElement(Pagination, { page: 2, pageSize: 25, total: 30, query: { status: "active" } }));

    expect(firstPage).toContain('aria-disabled="true"');
    expect(firstPage).toContain("Página siguiente");
    expect(lastPage).toContain('aria-disabled="true"');
    expect(lastPage).toContain("Página anterior");
  });

  it("keeps unrelated filters while changing a tab", () => {
    const markup = renderToStaticMarkup(createElement(TableToolbar, {
      query: { q: "factura", integration: "intellydte", page: "3" },
      tabs: [{ value: "all", label: "Todas" }, { value: "processing", label: "Procesando" }],
    }));

    expect(markup).toContain("tab=processing");
    expect(markup).toContain("integration=intellydte");
    expect(markup).toContain("page=1");
  });
});
