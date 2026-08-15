import { expect, test } from "@playwright/test";

test.skip(!process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD, "Requires an isolated seeded E2E account.");

test("shows fiscal billing filters and private evidence actions", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(process.env.E2E_USER_EMAIL!);
  await page.getByLabel("Contraseña").fill(process.env.E2E_USER_PASSWORD!);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page.goto("/facturacion");
  await expect(page.getByRole("heading", { name: "Facturación" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Emitidas" })).toBeVisible();
  await expect(page.getByRole("button", { name: /buscar/i })).toBeVisible();
});
