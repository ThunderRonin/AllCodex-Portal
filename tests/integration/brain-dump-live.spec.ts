import { test, expect } from "@playwright/test";
import { requireIntegrationEnv } from "../helpers/integration-guard";

// Skip if we don't have real credentials
requireIntegrationEnv();

test.describe("Live Integration: Brain Dump", () => {
  test.describe.configure({ retries: 1 });
  test.setTimeout(240_000);

  test("processes a real brain dump and creates a note", async ({ page }) => {
    // Generate a unique ID for this test run so we can find it
    const uniqueId = `TestEntity-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const testText =
      `${uniqueId} is a completely new and unique entity that has never been recorded anywhere. ` +
      `The full canonical name is exactly "${uniqueId}" — this exact string must be used as the note title. ` +
      `It is a mysterious crystal spire that appeared overnight in an uncharted desert. ` +
      `File "${uniqueId}" as a brand-new location entry; do not merge with any existing notes.`;

    await page.goto("/brain-dump");

    const textarea = page.getByPlaceholder(/write anything/i);
    await textarea.fill(testText);

    // Submit
    await page.getByRole("button", { name: /process with allknower/i }).click();

    // Wait for the pipeline to finish — first the button exits its processing state,
    // then the completion banner appears.
    await expect(page.getByRole("button", { name: /processing…/i })).toHaveCount(0, { timeout: 120_000 });
    await expect(page.getByText(/Processing Complete/i)).toBeVisible({ timeout: 15_000 });

    // The completed run should expose a lore entry link for the unique location.
    const noteLink = page
      .locator("a[href*='/lore/']")
      .filter({ hasText: uniqueId })
      .first();
    await expect(noteLink).toBeVisible({ timeout: 15_000 });
    await noteLink.click();

    // Verify we landed on the note page — the title should contain our unique ID.
    // The body is LLM-generated and may paraphrase; check for thematic keywords.
    await expect(page.getByRole("heading", { name: uniqueId })).toBeVisible();
    await expect(page.locator(".wiki-article")).toContainText(/crystal|spire|desert|mysterious/i);
  });
});
