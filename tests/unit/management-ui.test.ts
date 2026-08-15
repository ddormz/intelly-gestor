import { createElement } from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getNavigationLinks } from "@/components/layout/app-shell";
import { resolveComboBoxSelection, resolveComboBoxValue } from "@/components/ui/combo-box";
import { IconButton } from "@/components/ui/icon-button";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { TableShell } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/submit-button";

describe("management UI foundation", () => {
  it("renders an accessible modal with explicit close controls", () => {
    const markup = renderToStaticMarkup(createElement(Modal, {
      open: true,
      onClose() {},
      title: "Nuevo cliente",
      description: "Ingresa sus datos tributarios.",
      children: createElement("p", null, "Formulario"),
    }));

    expect(markup).toContain("aria-modal=\"true\"");
    expect(markup).toContain("Nuevo cliente");
    expect(markup).toContain("Cerrar modal");
    expect(markup).toContain('data-tooltip="Cerrar modal"');
    expect(markup).not.toContain("Operación segura");
  });

  it("separates Users from Integrations and hides it from operators", () => {
    expect(getNavigationLinks("admin").map((link) => link.href)).toContain("/usuarios");
    expect(getNavigationLinks("operator").map((link) => link.href)).not.toContain("/usuarios");
  });

  it("gives icon actions an accessible name and focusable tooltip", () => {
    const markup = renderToStaticMarkup(createElement(IconButton, {
      label: "Editar cliente",
      icon: createElement("span", null, "icon"),
    }));

    expect(markup).toContain('aria-label="Editar cliente"');
    expect(markup).toContain('data-tooltip="Editar cliente"');
    expect(markup).toContain('title="Editar cliente"');
    expect(markup).toContain("icon-button-tooltip");
    expect(markup).toContain("Editar cliente");
  });

  it("preserves the semantic variant on icon-only submit buttons", () => {
    const markup = renderToStaticMarkup(createElement(SubmitButton, {
      iconOnly: true,
      label: "Cerrar sesión",
      variant: "secondary",
      icon: createElement("span", null, "icon"),
    }));

    expect(markup).toContain("icon-button btn-secondary");
  });

  it("invalidates a stale ComboBox value when display text changes to another label", () => {
    expect(resolveComboBoxValue("Servicio B", "Servicio A", "service-a")).toBe("");
    expect(resolveComboBoxValue("Servicio A", "Servicio A", "service-a")).toBe("service-a");
    expect(resolveComboBoxSelection("service-a", [{ value: "service-b", label: "Servicio B" }])).toBe("");
  });

  it("gives pagination controls tooltip attributes", () => {
    const markup = renderToStaticMarkup(createElement(Pagination, { page: 2, pageSize: 25, total: 75, query: {} }));

    expect(markup).toContain('data-tooltip="Página anterior"');
    expect(markup).toContain('data-tooltip="Página siguiente"');
  });

  it("keeps the table surface on TableShell instead of nesting a card", () => {
    const markup = renderToStaticMarkup(createElement(TableShell, { children: createElement("tbody") }));

    expect(markup).toContain('class="data-table-wrap"');
    expect(markup).not.toContain("surface");
    expect(markup).not.toContain("brand-card");
  });

  it("uses an icon-only logout action without removing assistive labels", () => {
    const source = readFileSync(new URL("../../src/components/layout/app-shell.tsx", import.meta.url), "utf8");

    expect(source).toContain("LogOut");
    expect(source).toContain("Cerrar sesión");
    expect(source).toContain("iconOnly");
    expect(source).not.toContain('<span className={compact ? "sr-only" : ""}>Cerrar sesión</span>');
    expect(source).toContain("aria-label");
    expect(source).toContain("IconButton");
    expect(source).toContain("data-tooltip");
  });

  it("keeps tooltip surfaces visible around scrolling tables and collapsed navigation", () => {
    const styles = readFileSync(new URL("../../src/app/globals.css", import.meta.url), "utf8");

    expect(styles).toContain(".data-table-scroll .icon-button");
    expect(styles).toContain(".shell-sidebar nav a[data-tooltip]");
  });

  it("includes terminal order and processing integration filters", () => {
    const orderSource = readFileSync(new URL("../../src/app/(dashboard)/ordenes/order-manager.tsx", import.meta.url), "utf8");
    const integrationSource = readFileSync(new URL("../../src/app/(dashboard)/integraciones/integration-manager.tsx", import.meta.url), "utf8");

    expect(orderSource).toContain('value: "cancelled"');
    expect(orderSource).toContain('value: "expired"');
    expect(integrationSource).toContain('value: "processing"');
  });
});
