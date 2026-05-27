import { test, expect } from "@playwright/test";
import { installPortalApiMocks } from "./helpers/mock-api";
import { attachConsoleErrorCollector, expectNoConsoleErrors } from "./helpers/test-utils";

test("statblock list renders with name and CR badge", async ({ page }) => {
  const errors = attachConsoleErrorCollector(page);
  await installPortalApiMocks(page);

  await page.goto("/statblocks");

  await expect(page.getByText("Cave Bear")).toBeVisible();
  await expect(page.getByText("Shadow Wraith")).toBeVisible();
  // CR badges
  await expect(page.getByText(/CR 2/).first()).toBeVisible();
  await expect(page.getByText(/CR 5/).first()).toBeVisible();
  await expectNoConsoleErrors(errors);
});

test("clicking a statblock entry shows the StatblockCard in the right pane", async ({ page }) => {
  const errors = attachConsoleErrorCollector(page);
  await installPortalApiMocks(page);

  await page.goto("/statblocks");

  await page.getByText("Cave Bear").click();

  // StatblockCard should appear with full detail
  await expect(page.getByText("Armor Class").first()).toBeVisible();
  await expect(page.getByText("Hit Points").first()).toBeVisible();
  await expect(page.getByText(/beast/i).first()).toBeVisible();
  await expectNoConsoleErrors(errors);
});

test("StatblockCard renders ability scores with correct modifiers", async ({ page }) => {
  const errors = attachConsoleErrorCollector(page);
  await installPortalApiMocks(page);

  await page.goto("/statblocks");

  await page.getByText("Cave Bear").click();

  // STR 20 → modifier +5
  await expect(page.getByText(/\+5/).first()).toBeVisible();
  // DEX 10 → modifier +0
  await expect(page.getByText(/\+0/).first()).toBeVisible();
  await expectNoConsoleErrors(errors);
});

test("search filter narrows the statblock list", async ({ page }) => {
  const errors = attachConsoleErrorCollector(page);
  await installPortalApiMocks(page);

  await page.goto("/statblocks");

  await expect(page.getByText("Cave Bear")).toBeVisible();
  await expect(page.getByText("Shadow Wraith")).toBeVisible();

  await page.getByPlaceholder(/search/i).fill("cave");

  await expect(page.getByText("Cave Bear")).toBeVisible();
  await expect(page.getByText("Shadow Wraith")).not.toBeVisible();
  await expectNoConsoleErrors(errors);
});

test("CR range filter hides entries outside the range", async ({ page }) => {
  const errors = attachConsoleErrorCollector(page);
  await installPortalApiMocks(page);

  await page.goto("/statblocks");

  await expect(page.getByText("Cave Bear")).toBeVisible();
  await expect(page.getByText("Shadow Wraith")).toBeVisible();

  // Click "5–14" CR filter
  await page.getByRole("button", { name: /5.?14/i }).click();

  // Cave Bear is CR 2, should be hidden; Shadow Wraith is CR 5, should be visible
  await expect(page.getByText("Shadow Wraith")).toBeVisible();
  await expect(page.getByText("Cave Bear")).not.toBeVisible();
  await expectNoConsoleErrors(errors);
});

test("editing a statblock saves and updates its displayed properties", async ({ page }) => {
  const errors = attachConsoleErrorCollector(page);
  await installPortalApiMocks(page);

  await page.goto("/statblocks");

  await page.getByText("Cave Bear").click();

  // Click edit button
  await page.locator('button[title="Edit Statblock"]').click();

  // Change values
  await page.getByLabel("Display Name (crName)").fill("Dire Cave Bear");
  await page.getByLabel("Armor Class (AC)").fill("15");
  await page.getByLabel("Hit Points (HP)").fill("60");
  
  // Click save
  await page.getByRole("button", { name: /Save Changes/i }).click();

  // Verify updated read-only card
  await expect(page.locator("h2", { hasText: "Dire Cave Bear" })).toBeVisible();
  await expect(page.getByText("15").first()).toBeVisible(); // AC 15
  await expect(page.getByText("60").first()).toBeVisible(); // HP 60
  await expectNoConsoleErrors(errors);
});

test("creating a new statblock adds it to the list and opens edit mode", async ({ page }) => {
  const errors = attachConsoleErrorCollector(page);
  await installPortalApiMocks(page);

  await page.goto("/statblocks");

  // Click "+ New" button
  await page.getByRole("button", { name: /\+ New/i }).click();

  // Form should be in edit mode
  await expect(page.getByText("Edit Statblock")).toBeVisible();
  
  // Name should be "New Statblock" initially
  await expect(page.getByLabel("Creature Title (Note Title)")).toHaveValue("New Statblock");

  // Change title, display name and save
  await page.getByLabel("Creature Title (Note Title)").fill("Dire Wolf");
  await page.getByLabel("Display Name (crName)").fill("Dire Wolf");
  await page.getByRole("button", { name: /Save Changes/i }).click();

  // Verify list and detail updated
  await expect(page.locator("h2", { hasText: "Dire Wolf" })).toBeVisible();
  await expect(page.getByText("Dire Wolf").first()).toBeVisible();
  await expectNoConsoleErrors(errors);
});
