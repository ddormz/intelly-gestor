import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BrandLogo } from "@/components/brand/brand-logo";
import { PageHeader } from "@/components/ui/page-header";
import { getStatusLabel } from "@/lib/presentation";
import { formatClpAmount } from "@/lib/money";

describe("Intelly presentation system", () => {
  it("formats persisted CLP decimal values without changing domain money math", () => {
    expect(formatClpAmount("4850000.00")).toContain("4.850.000");
    expect(formatClpAmount(0)).toContain("$0");
  });

  it("centralizes Spanish labels for financial states", () => {
    expect(getStatusLabel("draft")).toBe("Borrador");
    expect(getStatusLabel("paid")).toBe("Pagada");
    expect(getStatusLabel("unknown")).toBe("Unknown");
  });

  it("renders the official Intelly logo instead of temporary initials", () => {
    const html = renderToStaticMarkup(createElement(BrandLogo, { variant: "full" }));
    expect(html).toContain("intelly-logo.png");
    expect(html).toContain("Intelly");
    expect(html).not.toContain(">IG<");
  });

  it("renders a consistent accessible page heading contract", () => {
    const html = renderToStaticMarkup(createElement(PageHeader, {
      eyebrow: "Últimos 30 días",
      title: "Resumen del negocio",
      description: "Cobros y facturación en una sola vista.",
    }));
    expect(html).toContain("Últimos 30 días");
    expect(html).toContain("<h1");
    expect(html).toContain("Resumen del negocio");
  });
});
