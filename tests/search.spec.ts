import { test, expect } from "@playwright/test";
import { installPortalApiMocks } from "./helpers/mock-api";
import { attachConsoleErrorCollector, expectNoConsoleErrors } from "./helpers/test-utils";

test("ETAPI mode returns results for a matching query", async ({ page }) => {
  const errors = attachConsoleErrorCollector(page);
  await installPortalApiMocks(page);

  await page.goto("/search");

  await page.getByRole("tab", { name: /attribute/i }).click();
  const input = page.getByPlaceholder(/search by title/i);
  await input.fill("Aria");
  await page.getByRole("button", { name: /search/i }).click();

  await expect(page.getByText("Aria Vale").first()).toBeVisible();
  await expectNoConsoleErrors(errors);
});

test("ETAPI mode shows no-results state when nothing matches", async ({ page }) => {
  const errors = attachConsoleErrorCollector(page);
  await installPortalApiMocks(page, { searchResults: [] });

  await page.goto("/search");

  await page.getByRole("tab", { name: /attribute/i }).click();
  const input = page.getByPlaceholder(/search by title/i);
  await input.fill("xyzzy_no_match");
  await page.getByRole("button", { name: /search/i }).click();

  await expect(page.getByText(/no results found/i)).toBeVisible();
  await expectNoConsoleErrors(errors);
});

test("Semantic (AI) tab is visible and accepts a query", async ({ page }) => {
  const errors = attachConsoleErrorCollector(page);
  await installPortalApiMocks(page);

  await page.goto("/search");

  // The AI/RAG tab should exist
  const semanticTab = page.getByRole("tab", { name: /semantic/i });
  await expect(semanticTab).toBeVisible();
  await semanticTab.click();

  const input = page.getByPlaceholder(/describe what/i);
  await expect(input).toBeVisible();
  await expectNoConsoleErrors(errors);
});

test("clicking a result navigates to the lore detail page", async ({ page }) => {
  const errors = attachConsoleErrorCollector(page);
  await installPortalApiMocks(page);

  await page.goto("/search");

  await page.getByRole("tab", { name: /attribute/i }).click();
  const input = page.getByPlaceholder(/search by title/i);
  await input.fill("Aria");
  await page.getByRole("button", { name: /search/i }).click();

  await page.getByRole("link", { name: /Aria Vale/i }).first().click();
  await expect(page).toHaveURL(/\/lore\/note-1$/);
  await expectNoConsoleErrors(errors);
});

test("URL updates with q param after search submit", async ({ page }) => {
  const errors = attachConsoleErrorCollector(page);
  await installPortalApiMocks(page);

  await page.goto("/search");

  await page.getByRole("tab", { name: /attribute/i }).click();
  const input = page.getByPlaceholder(/search by title/i);
  await input.fill("Aether");
  await page.getByRole("button", { name: /search/i }).click();

  await expect(page).toHaveURL(/[?&]q=Aether/);
  await expectNoConsoleErrors(errors);
});

test("RAG 503 shows the AllKnower service banner instead of the no-results state", async ({ page }) => {
  await installPortalApiMocks(page);
  await page.route("**/api/rag", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "UNREACHABLE", message: "AllKnower is unreachable" }),
      });
      return;
    }
    await route.fallback();
  });

  await page.goto("/search?q=Aria");

  await expect(page.getByText(/allknower unavailable/i)).toBeVisible();
  await expect(page.getByText(/no results found/i)).toHaveCount(0);
});
