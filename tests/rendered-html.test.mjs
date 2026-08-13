import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const nextBin = fileURLToPath(
  new URL("../node_modules/next/dist/bin/next", import.meta.url),
);
const root = fileURLToPath(new URL("../", import.meta.url));
const port = 32000 + (process.pid % 1000);

async function waitForServer(url, server, getOutput) {
  const deadline = Date.now() + 20_000;

  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Next.js exited before becoming ready.\n${getOutput()}`);
    }

    try {
      return await fetch(url);
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  throw new Error(`Next.js did not become ready within 20 seconds.\n${getOutput()}`);
}

test("renders the Intelly payment-order application shell", async () => {
  const server = spawn(process.execPath, [nextBin, "start", "-p", String(port)], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  server.stdout.on("data", (chunk) => {
    output += chunk;
  });
  server.stderr.on("data", (chunk) => {
    output += chunk;
  });

  try {
    const response = await waitForServer(
      `http://127.0.0.1:${port}/`,
      server,
      () => output,
    );
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

    const html = await response.text();
    assert.match(html, /<html lang="es">/i);
    assert.match(html, /Generador de Órdenes de Pago \| Intelly/i);
    assert.match(html, /intelly-isotipo\.png/i);
    assert.match(html, /og\.png/i);
    assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
  } finally {
    server.kill();
  }
});

test("preserves existing payment settings while filling migration defaults", async () => {
  const { mergePaymentDetails } = await import(
    new URL("../lib/payment-details.js", import.meta.url),
  );
  const existing = {
    companyName: "Cliente SpA",
    companyRut: "76.123.456-7",
    email: "finanzas@cliente.cl",
    bankName: "Banco cliente",
    accountType: "Cuenta vista",
    accountNumber: "12345678",
    accountHolder: "Cliente SpA",
    accountRut: "76.123.456-7",
    transferEmail: "pagos@cliente.cl",
  };
  const defaults = {
    companyName: "INTELLY SPA",
    companyRut: "78.202.703-4",
    email: "dramirez@intelly.cl",
    bankName: "Banco de Chile",
    accountType: "Cuenta Corriente",
    accountNumber: "00-171-21318-01",
    accountHolder: "INTELLY SPA",
    accountRut: "78.202.703-4",
    transferEmail: "dramirez@intelly.cl",
    paymentTerms: "Pago dentro de 10 días.",
  };

  assert.deepEqual(mergePaymentDetails(existing, defaults), {
    ...defaults,
    ...existing,
  });
});

test("keeps required client-side order behavior in the product source", async () => {
  const [page, pdf] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/order-pdf.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /STORAGE_KEYS\.settings/);
  assert.match(page, /STORAGE_KEYS\.orders/);
  assert.match(page, /STORAGE_KEYS\.sequence/);
  assert.match(page, /OP-\$\{year\}-\$\{String\(sequence\)\.padStart\(4, "0"\)\}/);
  assert.match(page, /Math\.round\(discountedSubtotal \* 0\.19\)/);
  assert.match(page, /discountPercent/);
  assert.match(page, /discountReason/);
  assert.match(page, /Indica el motivo del descuento/);
  assert.match(page, /Servicio de Hosting/);
  assert.match(page, /Servicio libre/);
  assert.match(page, /pdf\.save\(`orden-pago-\$\{target\.number\}\.pdf`\)/);
  assert.match(page, /Exportar respaldo/);
  assert.match(page, /Importar respaldo/);
  assert.match(page, /accept="application\/json,\.json"/);
  assert.match(page, /parseOrderBackup/);
  assert.match(page, /createOrderBackup/);
  assert.match(pdf, /format: "a4"/);
  assert.match(pdf, /autoTable\(doc/);
  assert.match(pdf, /DATOS PARA TRANSFERENCIA|Datos para transferencia/);
  assert.match(pdf, /CONDICIONES Y PLAZOS|Condiciones y plazos/);
});
