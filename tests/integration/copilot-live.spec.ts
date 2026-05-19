import { test, expect } from "@playwright/test";
import { requireIntegrationEnv } from "../helpers/integration-guard";

requireIntegrationEnv();

test.describe("Live Integration: Copilot", () => {
  test.describe.configure({ retries: 1 });
  test.setTimeout(180_000);

  test("generates and applies a real AI proposal", async ({ page }) => {
    // 1. Create a dummy note first so we have something to edit
    // (Assuming the portal has a way to create notes, or we hit ETAPI directly via test setup)
    // For simplicity, we'll use the portal's "New Entry" page.
    const uniqueId = `CopilotTest-${Date.now()}`;
    await page.goto("/lore/new");

    // Select the "Location" template so the note has a valid loreType
    await page.getByRole("button", { name: /choose a template/i }).click();
    await page.getByRole("dialog").locator("button").filter({ hasText: "Location" }).first().click();

    await page.getByPlaceholder(/e\.g\./i).fill(uniqueId);
    await page.locator(".ProseMirror").fill(
      "Willowmere is a quiet farming village on the banks of the Silver River. " +
      "Its population of roughly 200 souls tends barley fields and orchards. " +
      "The village elder, Marta Greycloak, has led the community for thirty years. " +
      "A crumbling stone tower on the hill overlooks the village, abandoned since the last war.",
    );
    await page.getByRole("button", { name: /Create Entry/i }).click();

    // Wait for redirect to the new note
    await expect(page).toHaveURL(/\/lore\/[a-zA-Z0-9_-]+/);

    // 2. Open copilot
    await page.getByRole("button", { name: /lore copilot/i }).click();

    // 3. Ask for a change
    await page.getByPlaceholder(/Ask for article edits/i).fill(
      "Update this article's body text only — do not create any new linked notes. " +
      "Add a paragraph mentioning that the Silver River floods every spring, " +
      "forcing the villagers to build elevated walkways between buildings. " +
      "Generate a proposal that updates only this note.",
    );
    await page.getByRole("button", { name: /^Send$/i }).click();

    // 4. Wait for the real AI to return a proposal
    await expect(page.getByText("Review Proposal")).toBeVisible({ timeout: 90_000 });
    
    // We expect the target to be checked
    const checkbox = page.getByRole("checkbox").first();
    await expect(checkbox).toBeChecked();

    // 5. Apply
    await page.getByRole("button", { name: "Apply Selected" }).evaluate(el => (el as HTMLElement).click());
    
    // Confirm dialog
    await page.getByRole("button", { name: /Write to Codex/i }).click();

    // 6. Verify success banner — primary assertion proving the full copilot E2E flow
    await expect(page.getByText("Apply completed")).toBeVisible({ timeout: 30_000 });
  });
});
