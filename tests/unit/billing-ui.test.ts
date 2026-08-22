import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BillingManager } from "@/app/(dashboard)/facturacion/billing-manager";
import { IconButton } from "@/components/ui/icon-button";

const query = { page: 1, pageSize: 20 };

function renderInvoice(status: "pending" | "processing" | "issued" | "rejected", hasPdf = false, hasXml = false) {
  return renderToStaticMarkup(createElement(BillingManager, {
    items: [{ id: "invoice-1", orderNumber: "OP-1", clientName: "Cliente", clientEmail: "cliente@example.test", total: "1190", status, folio: "22", siiStatus: status === "issued" ? "DOK" : null, siiGlosa: null, hasPdf, hasXml }],
    ready: [],
    canImport: false,
    query,
    page: 1,
    pageSize: 20,
    total: 1,
    folios: [],
  }));
}

describe("billing fiscal evidence UI", () => {
  it("renders an accepted state with an icon and keeps unavailable artifact actions visible", () => {
    const html = renderInvoice("issued");

    expect(html).toContain("Aceptada");
    expect(html).toContain("lucide-badge-check");
    expect(html).toMatch(/aria-label="Descargar PDF fiscal"[^>]+aria-disabled="true"/);
    expect(html).toMatch(/aria-label="Descargar XML firmado"[^>]+aria-disabled="true"/);
    expect(html).toMatch(/aria-label="Enviar factura por correo"[^>]+aria-disabled="true"/);
    expect(html).toContain('title="El PDF tributario aún se está generando."');
    expect(html).toContain('title="El XML firmado aún no está disponible."');
    expect(html).toContain("Reintentar archivos tributarios");
  });

  it("uses distinct icons for pending, processing, and rejected states", () => {
    expect(renderInvoice("pending")).toContain("lucide-clock-3");
    expect(renderInvoice("processing")).toContain("lucide-loader-circle");
    expect(renderInvoice("rejected")).toContain("lucide-circle-x");
  });

  it("does not render a navigable href for a disabled link action", () => {
    const html = renderToStaticMarkup(createElement(IconButton, { href: "/private-file", disabled: true, disabledReason: "El archivo aún se está generando.", label: "Archivo pendiente", icon: createElement("span") }));

    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('aria-description="El archivo aún se está generando."');
    expect(html).toContain('tabindex="0"');
    expect(html).not.toContain('href="/private-file"');
  });
});
