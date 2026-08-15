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

test("renders the Intelly Gestor application shell with security headers", async () => {
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
    assert.match(html, /Intelly Gestor/i);
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
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

test("keeps secure order behavior and the reusable PDF foundation", async () => {
  const [orders, session, pdf] = await Promise.all([
    readFile(new URL("../src/features/orders/service.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/features/auth/session.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/order-pdf.ts", import.meta.url), "utf8"),
  ]);

  assert.match(orders, /publicToken/);
  assert.match(orders, /idempotencyKey/);
  assert.match(orders, /transaction/);
  assert.match(session, /httpOnly/);
  assert.match(session, /sameSite:\s*"lax"/);
  assert.match(session, /secure:/);
  assert.match(pdf, /format: "a4"/);
  assert.match(pdf, /autoTable\(doc/);
  assert.match(pdf, /DATOS PARA TRANSFERENCIA|Datos para transferencia/);
  assert.match(pdf, /CONDICIONES Y PLAZOS|Condiciones y plazos/);
});

test("exposes the legacy PDF from authenticated and public order views", async () => {
  const [manager, publicOrder, privateRoute, publicRoute] = await Promise.all([
    readFile(new URL("../src/app/(dashboard)/ordenes/order-manager.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/orden/[publicToken]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/orders/[id]/pdf/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/public/orders/[publicToken]/pdf/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(manager, /\/api\/orders\/\$\{order\.id\}\/pdf/);
  assert.match(publicOrder, /\/api\/public\/orders\/\$\{publicToken\}\/pdf/);
  assert.match(privateRoute, /requireUser/);
  assert.match(publicRoute, /findPublicOrderPdf/);
});

test("exposes project catalog controls and active defaults", async () => {
  const [page, manager] = await Promise.all([
    readFile(new URL("../src/app/(dashboard)/productos-servicios/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/(dashboard)/productos-servicios/catalog-manager.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /allowedTabs: \["active", "inactive", "all"\], defaultTab: "active"/);
  assert.match(manager, /value: "project", label: "Proyectos"/);
  assert.match(manager, /item \? <Field label="Código"/);
  assert.doesNotMatch(manager, /generateCatalogCode/);
  assert.doesNotMatch(manager, /<Card/);
});

test("keeps catalog/client tabs, dependent geography, lookup, and typed order selectors explicit", async () => {
  const [catalogPage, clientsPage, clientManager, orderManager, integrationManager] = await Promise.all([
    readFile(new URL("../src/app/(dashboard)/productos-servicios/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/(dashboard)/clientes/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/(dashboard)/clientes/client-manager.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/(dashboard)/ordenes/order-manager.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/(dashboard)/integraciones/integration-manager.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(catalogPage, /allowedTabs: \["active", "inactive", "all"\]/);
  assert.match(clientsPage, /allowedTabs: \["active", "inactive", "all"\]/);
  assert.match(clientManager, /listCommunes\(region\)/);
  assert.match(clientManager, /cityForCommune\(region, commune\)/);
  assert.match(clientManager, /\/api\/clients\/rut/);
  assert.match(orderManager, /item\.type === "project"/);
  assert.match(integrationManager, /placeholder="https:\/\/api\.intellydte\.cl"/);
});

test("keeps settled POS controls disabled and revalidates order availability after base-data creation", async () => {
  const [pos, clientActions, catalogActions] = await Promise.all([
    readFile(new URL("../src/app/(dashboard)/ordenes/nueva/order-pos.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/features/clients/actions.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/features/catalog/actions.ts", import.meta.url), "utf8"),
  ]);
  assert.match(pos, /discountNeedsReason/);
  assert.match(pos, /disabled=\{!editable\}/);
  assert.match(pos, /getStatusLabel\(initial\.status\)/);
  assert.match(clientActions, /revalidatePath\("\/ordenes"\)/);
  assert.match(catalogActions, /revalidatePath\("\/ordenes"\)/);
});
