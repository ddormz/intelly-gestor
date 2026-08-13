import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("https://ordenes.intelly.test/", {
      headers: {
        accept: "text/html",
        host: "ordenes.intelly.test",
        "x-forwarded-proto": "https",
      },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("renders the Intelly payment-order application shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="es">/i);
  assert.match(html, /Generador de Órdenes de Pago \| Intelly/i);
  assert.match(html, /intelly-isotipo\.png/i);
  assert.match(html, /og\.png/i);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("keeps required client-side order behavior in the product source", async () => {
  const [page, pdf] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/order-pdf.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /intelly\.op\.settings\.v1/);
  assert.match(page, /intelly\.op\.orders\.v1/);
  assert.match(page, /intelly\.op\.sequence\.v1/);
  assert.match(page, /OP-\$\{year\}-\$\{String\(sequence\)\.padStart\(4, "0"\)\}/);
  assert.match(page, /Math\.round\(discountedSubtotal \* 0\.19\)/);
  assert.match(page, /discountPercent/);
  assert.match(page, /discountReason/);
  assert.match(page, /Indica el motivo del descuento/);
  assert.match(page, /Servicio de Hosting/);
  assert.match(page, /Servicio libre/);
  assert.match(page, /pdf\.save\(`orden-pago-\$\{target\.number\}\.pdf`\)/);
  assert.match(pdf, /format: "a4"/);
  assert.match(pdf, /autoTable\(doc/);
  assert.match(pdf, /DATOS PARA TRANSFERENCIA|Datos para transferencia/);
  assert.match(pdf, /CONDICIONES Y PLAZOS|Condiciones y plazos/);
});
