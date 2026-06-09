import { test, expect } from "@playwright/test";
import { installPortalApiMocks } from "./helpers/mock-api";
import { attachConsoleErrorCollector, expectNoConsoleErrors } from "./helpers/test-utils";

test("app loads with grimoire chrome and lore browser navigation", async ({ page }) => {
  const errors = attachConsoleErrorCollector(page);
  await installPortalApiMocks(page);

  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { name: "Chronicle Overview" })).toBeVisible();
  await expect(page.getByText("AllCodex").first()).toBeVisible();
  await expect(page.getByText("Lore Chronicle")).toBeVisible();
  await expect(page.getByRole("link", { name: "Lore Browser" })).toBeVisible();

  const cinzelFont = await page.locator("h1").first().evaluate((element) => getComputedStyle(element).fontFamily);
  expect(cinzelFont.toLowerCase()).toContain("cinzel");

  await page.getByRole("link", { name: "Lore Browser" }).click();
  await expect(page.getByRole("heading", { name: "Lore Browser" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Aria Vale/i })).toBeVisible();

  await page.screenshot({ path: test.info().outputPath("portal-smoke.png"), fullPage: true });
  await expectNoConsoleErrors(errors);
});