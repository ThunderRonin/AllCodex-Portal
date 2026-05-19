import { test, expect } from "@playwright/test";
import { buildNote, installPortalApiMocks } from "./helpers/mock-api";

// This test file should only be run by the 'mobile-chrome' project
test.describe("Mobile Viewport Layouts", () => {
  test.skip(({ isMobile }) => !isMobile, "Mobile tests only run in mobile viewport projects");

  test("sidebar navigation collapses into a hamburger menu", async ({ page }) => {
    await installPortalApiMocks(page);
    await page.goto("/");

    // Desktop sidebar should be hidden
    const sidebar = page.locator("aside.fixed").first();
    await expect(sidebar).toBeHidden();

    // Hamburger button should be visible in the header
    const menuButton = page.getByRole("button", { name: /toggle menu|menu/i });
    await expect(menuButton).toBeVisible();

    // Clicking it opens the mobile nav sheet
    await menuButton.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("link", { name: "Dashboard" }).first()).toBeVisible();
  });

  test("lore detail page copilot sheet is usable", async ({ page }) => {
    await installPortalApiMocks(page, {
      notes: [buildNote({ noteId: "note-1", title: "Aria Vale" })],
    });
    await page.goto("/lore/note-1");

    // Open copilot
    const copilotBtn = page.getByRole("button", { name: /lore copilot/i });
    await expect(copilotBtn).toBeVisible();
    await copilotBtn.click();

    // The sheet should open
    await expect(page.getByRole("heading", { name: "Article-Scoped Copilot" })).toBeVisible();
    
    // The input and send button should be usable
    const input = page.getByPlaceholder(/Ask for article edits/i);
    await expect(input).toBeVisible();
    
    // We should be able to type
    await input.fill("test on mobile");
    await expect(input).toHaveValue("test on mobile");
  });

  test("brain dump interface is responsive", async ({ page }) => {
    await installPortalApiMocks(page);
    await page.goto("/brain-dump");

    // Main text area and submit button should be visible without horizontal scrolling
    const textarea = page.getByPlaceholder(/write anything/i);
    await expect(textarea).toBeVisible();
    
    const submitBtn = page.getByRole("button", { name: /process with allknower/i });
    await expect(submitBtn).toBeVisible();
    
    // Width should fit the viewport (approx < 500px)
    const box = await textarea.boundingBox();
    expect(box!.width).toBeLessThan(500);
  });
});
