import { test, expect } from "@playwright/test";
import { installPortalApiMocks } from "./helpers/mock-api";

test.describe("Command Palette", () => {
  test("opens with keyboard shortcut and filters results", async ({ page, isMobile }) => {
    // Skip on mobile since we don't typically use Cmd+K on touch devices
    if (isMobile) return;

    await installPortalApiMocks(page);
    await page.goto("/");

    // Press Cmd+K (Mac) or Ctrl+K (Windows)
    const modifier = process.platform === "darwin" ? "Meta" : "Control";
    await page.keyboard.press(`${modifier}+k`);

    // Verify dialog opens
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Verify items are present
    await expect(dialog.getByText("Dashboard")).toBeVisible();
    await expect(dialog.getByText("Brain Dump")).toBeVisible();

    // Search for something specific
    await page.getByPlaceholder(/Type a command/i).fill("Relationship");

    // Only Relationship Map should be visible
    await expect(dialog.getByText("Relationship Map")).toBeVisible();
    await expect(dialog.getByText("Brain Dump")).toBeHidden();
  });

  test("navigates on item selection", async ({ page, isMobile }) => {
    if (isMobile) return;

    await installPortalApiMocks(page);
    await page.goto("/");

    const modifier = process.platform === "darwin" ? "Meta" : "Control";
    await page.keyboard.press(`${modifier}+k`);

    // Click "Brain Dump"
    await page.getByRole("dialog").getByText("Brain Dump").click();

    // Verify dialog closes and navigation occurs
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page).toHaveURL(/.*\/brain-dump/);
  });
});
