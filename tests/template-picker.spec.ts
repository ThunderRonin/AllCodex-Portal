import { test, expect } from "@playwright/test";
import { buildNote, installPortalApiMocks } from "./helpers/mock-api";
import { attachConsoleErrorCollector, expectNoConsoleErrors } from "./helpers/test-utils";

test("template picker dialog is hidden on page load", async ({ page }) => {
  const errors = attachConsoleErrorCollector(page);
  await installPortalApiMocks(page);

  await page.goto("/lore/new");

  // Button to open picker should be visible; dialog should not be open
  await expect(page.getByRole("button", { name: /choose a template/i })).toBeVisible();
  await expect(page.getByRole("dialog")).not.toBeVisible();

  await expectNoConsoleErrors(errors);
});

test("template picker dialog opens on click", async ({ page }) => {
  const errors = attachConsoleErrorCollector(page);
  await installPortalApiMocks(page);

  await page.goto("/lore/new");

  await page.getByRole("button", { name: /choose a template/i }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/choose a template/i)).toBeVisible();

  await expectNoConsoleErrors(errors);
});

test("template picker dialog lists all template categories", async ({ page }) => {
  const errors = attachConsoleErrorCollector(page);
  await installPortalApiMocks(page);

  await page.goto("/lore/new");
  await page.getByRole("button", { name: /choose a template/i }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // Use h3 cells inside the grid to avoid matching attribute-badge spans
  // (e.g. "Location" appears as both a card title AND an attribute on Faction, Quest, etc.)
  await expect(dialog.locator("h3", { hasText: "Character" }).first()).toBeVisible();
  await expect(dialog.locator("h3", { hasText: "Location" }).first()).toBeVisible();
  await expect(dialog.locator("h3", { hasText: "Faction" }).first()).toBeVisible();
  await expect(dialog.locator("h3", { hasText: "Quest" }).first()).toBeVisible();
  await expect(dialog.locator("h3", { hasText: "Statblock" }).first()).toBeVisible();

  await expectNoConsoleErrors(errors);
});

test("template picker search filters results", async ({ page }) => {
  const errors = attachConsoleErrorCollector(page);
  await installPortalApiMocks(page);

  await page.goto("/lore/new");
  await page.getByRole("button", { name: /choose a template/i }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // Type "faction" into the search input
  await dialog.getByPlaceholder(/search templates/i).fill("faction");

  // Faction card h3 should be visible; Character card h3 should not
  await expect(dialog.locator("h3", { hasText: "Faction" })).toBeVisible();
  await expect(dialog.locator("h3", { hasText: "Character" })).not.toBeVisible();

  await expectNoConsoleErrors(errors);
});

test("template picker shows empty state when search has no matches", async ({ page }) => {
  const errors = attachConsoleErrorCollector(page);
  await installPortalApiMocks(page);

  await page.goto("/lore/new");
  await page.getByRole("button", { name: /choose a template/i }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder(/search templates/i).fill("zzznomatch");

  await expect(dialog.getByText(/no templates found/i)).toBeVisible();

  await expectNoConsoleErrors(errors);
});

test("selecting a template closes the dialog and shows template info in the sidebar", async ({ page }) => {
  const errors = attachConsoleErrorCollector(page);
  await installPortalApiMocks(page);

  await page.goto("/lore/new");
  await page.getByRole("button", { name: /choose a template/i }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // Click the Character card by targeting its h3 label (avoid button accessible-name
  // ambiguity caused by attribute badge spans inside each card)
  await dialog.locator("h3", { hasText: "Character" }).click();

  // Dialog should close
  await expect(page.getByRole("dialog")).not.toBeVisible();

  // Sidebar should now show the selected template label and description
  await expect(page.getByText("Character")).toBeVisible();
  await expect(page.getByText(/a person, npc/i)).toBeVisible();

  // "Change Template" link should be visible
  await expect(page.getByRole("button", { name: /change template/i })).toBeVisible();

  await expectNoConsoleErrors(errors);
});

test("selecting a template shows promoted fields for that entity type", async ({ page }) => {
  const errors = attachConsoleErrorCollector(page);
  await installPortalApiMocks(page);

  await page.goto("/lore/new");
  await page.getByRole("button", { name: /choose a template/i }).click();

  const dialog = page.getByRole("dialog");
  await dialog.locator("h3", { hasText: "Character" }).click();

  // Character template has promoted fields: Race, Role, Status, Goals
  await expect(page.getByLabel(/^race$/i)).toBeVisible();
  await expect(page.getByLabel(/^role$/i)).toBeVisible();
  await expect(page.getByLabel(/^status$/i)).toBeVisible();
  await expect(page.getByLabel(/^goals$/i)).toBeVisible();

  await expectNoConsoleErrors(errors);
});

test("changing template updates promoted fields", async ({ page }) => {
  const errors = attachConsoleErrorCollector(page);
  await installPortalApiMocks(page);

  await page.goto("/lore/new");

  // Select Character template first
  await page.getByRole("button", { name: /choose a template/i }).click();
  await page.getByRole("dialog").locator("h3", { hasText: "Character" }).click();

  // Character fields should appear
  await expect(page.getByLabel(/^race$/i)).toBeVisible();

  // Now change to Location template
  await page.getByRole("button", { name: /change template/i }).click();
  await page.getByRole("dialog").locator("h3", { hasText: "Location" }).click();

  // Location fields should appear: Type, Region, Population, Ruler
  await expect(page.getByLabel(/^type$/i)).toBeVisible();
  await expect(page.getByLabel(/^region$/i)).toBeVisible();

  // Character-specific "Race" field should be gone
  await expect(page.getByLabel(/^race$/i)).not.toBeVisible();

  await expectNoConsoleErrors(errors);
});

test("creating a note with a selected template sends loreType in POST body", async ({ page }) => {
  const errors = attachConsoleErrorCollector(page);
  const api = await installPortalApiMocks(page);

  // Capture the POST body via route interception
  let capturedBody: Record<string, unknown> | null = null;
  await page.route("**/api/lore", (route) => {
    if (route.request().method() === "POST") {
      capturedBody = route.request().postDataJSON() as Record<string, unknown>;
    }
    // Let the mock-api handler that was registered first handle the response
    route.fallback();
  });

  await page.goto("/lore/new");

  await page.locator("#title").fill("Aelarion the Undying");

  // Select Faction template — use h3 text to avoid attribute-badge strict mode violation
  await page.getByRole("button", { name: /choose a template/i }).click();
  await page.getByRole("dialog").locator("h3", { hasText: "Faction" }).click();

  await page.getByRole("button", { name: /create entry/i }).click();

  // Wait for navigation to the created note
  await expect(page).toHaveURL(/\/lore\//);

  expect(capturedBody).not.toBeNull();
  expect((capturedBody as unknown as Record<string, unknown>).loreType).toBe("faction");
  expect((capturedBody as unknown as Record<string, unknown>).templateId).toBe("_template_faction");

  // Confirm the note was stored with the correct loreType
  const createdNote = api.getNote("note-3");
  expect(createdNote?.attributes.find((a) => a.name === "loreType")?.value).toBe("faction");

  await expectNoConsoleErrors(errors);
});
