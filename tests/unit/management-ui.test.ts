import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getNavigationLinks } from "@/components/layout/app-shell";
import { Modal } from "@/components/ui/modal";

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
    expect(markup).not.toContain("Operación segura");
  });

  it("separates Users from Integrations and hides it from operators", () => {
    expect(getNavigationLinks("admin").map((link) => link.href)).toContain("/usuarios");
    expect(getNavigationLinks("operator").map((link) => link.href)).not.toContain("/usuarios");
  });
});
