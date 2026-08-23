import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OrderPos } from "@/app/(dashboard)/ordenes/nueva/order-pos";
import type { ActionState } from "@/lib/action-state";

const action = async (_state: ActionState, _formData: FormData): Promise<ActionState> => ({ status: "idle" });

describe("order free-line UI", () => {
  it("offers an explicit action to add a free line", () => {
    const html = renderToStaticMarkup(createElement(OrderPos, { action }));

    expect(html).toContain("Agregar ítem libre");
  });

  it("keeps a persisted free line visible while editing", () => {
    const html = renderToStaticMarkup(createElement(OrderPos, {
      action,
      initial: {
        id: "order-id",
        status: "draft",
        clientId: "client-id",
        clientName: "Cliente",
        clientEmail: "cliente@example.com",
        lines: [{ id: "free-line-id", catalogItemId: null, code: null, description: "Instalación especial", quantity: 1, unitPrice: 0, taxRate: 19 }],
      },
    }));

    expect(html).toContain("Instalación especial");
    expect(html).toContain("IVA 19%");
  });
});
