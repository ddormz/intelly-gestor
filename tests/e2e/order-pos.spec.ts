import { expect, test } from "@playwright/test";

test.skip(!process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD, "Requires an isolated seeded E2E account.");

test("creates and edits a multi-line payment order through the POS", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(process.env.E2E_USER_EMAIL!);
  await page.getByLabel("Contraseña").fill(process.env.E2E_USER_PASSWORD!);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page.goto("/ordenes/nueva");
  await expect(page.getByRole("heading", { name: "Nueva orden de pago" })).toBeVisible();

  await page.getByLabel("Buscar cliente").fill(process.env.E2E_CLIENT_QUERY ?? "cliente");
  await page.getByRole("button", { name: /cliente/i }).first().click();
  await page.getByLabel("Buscar concepto").fill(process.env.E2E_CATALOG_QUERY ?? "servicio");
  await page.getByRole("button", { name: /servicio|producto|proyecto/i }).last().click();
  await page.getByLabel("Buscar concepto").fill(process.env.E2E_CATALOG_QUERY_2 ?? "producto");
  await page.getByRole("button", { name: /servicio|producto|proyecto/i }).last().click();
  await expect(page.getByLabel(/Cantidad de/)).toHaveCount(2);
  await page.getByLabel(/Cantidad de/).fill("2");
  await page.getByLabel("Descuento (%)").fill("10");
  await page.getByLabel("Glosa del descuento").fill("Volumen");
  await expect(page.getByText("Resumen")).toBeVisible();
  await page.getByRole("button", { name: "Guardar borrador" }).click();
  await expect(page).toHaveURL(/\/ordenes\/[^/]+\/editar/);
  await page.getByLabel(/Precio de/).first().fill("13000");
  await page.getByLabel("Notas").fill("Editada desde POS");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Orden actualizada.")).toBeVisible();
});
