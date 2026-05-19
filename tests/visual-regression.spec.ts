/**
 * Visual Regression Tests
 *
 * These tests capture pixel-accurate screenshots of key portal pages and
 * compare them against stored baselines.
 *
 * FIRST RUN — create baselines:
 *   cd allcodex-portal && bun playwright test visual-regression --update-snapshots
 *
 * SUBSEQUENT RUNS — compare against baselines:
 *   cd allcodex-portal && bun playwright test visual-regression
 *
 * Baselines are committed to: tests/snapshots/<browser>/
 *
 * The threshold is 2 % (maxDiffPixelRatio: 0.02) — minor font-rendering
 * differences across platforms are tolerated.
 */
import { test, expect, type Page } from "@playwright/test";
import { buildNote, installPortalApiMocks } from "./helpers/mock-api";
import { attachConsoleErrorCollector } from "./helpers/test-utils";

// -----------------------------------------------------------------
// Stable seed data — fixed dates so screenshots are reproducible
// -----------------------------------------------------------------
const LORE_NOTES = [
  buildNote({
    noteId: "vr-note-1",
    title: "Aria Vale",
    dateCreated: "2025-01-15T08:00:00.000Z",
    dateModified: "2025-06-01T12:00:00.000Z",
    attributes: [
      { attributeId: "a1", name: "lore", value: "", type: "label" },
      { attributeId: "a2", name: "loreType", value: "character", type: "label" },
      { attributeId: "a3", name: "race", value: "Elf", type: "label" },
      { attributeId: "a4", name: "role", value: "Warden", type: "label" },
    ],
    content: "<h1>Aria Vale</h1><p>Warden of the Northern Reaches. Keeper of the ley breach.</p>",
  }),
  buildNote({
    noteId: "vr-note-2",
    title: "Aether Keep",
    dateCreated: "2025-02-10T10:00:00.000Z",
    dateModified: "2025-07-14T09:30:00.000Z",
    attributes: [
      { attributeId: "b1", name: "lore", value: "", type: "label" },
      { attributeId: "b2", name: "loreType", value: "location", type: "label" },
      { attributeId: "b3", name: "region", value: "Northern Reaches", type: "label" },
    ],
    content: "<h1>Aether Keep</h1><p>An ancient fortress perched above the ley breach.</p>",
  }),
];

/** Inject a style tag that disables all CSS animations and transitions. */
async function freezeAnimations(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `,
  });
}

// Use a fixed 1280×800 viewport for all visual tests
test.use({ viewport: { width: 1280, height: 800 } });

// -----------------------------------------------------------------
// Lore list page
// -----------------------------------------------------------------
test("visual: lore list page", async ({ page }) => {
  attachConsoleErrorCollector(page);
  await installPortalApiMocks(page, { notes: LORE_NOTES });

  await page.goto("/lore");
  await page.waitForLoadState("networkidle");
  await freezeAnimations(page);
  await page.waitForFunction(() => document.fonts.ready);

  await expect(page).toHaveScreenshot("lore-list.png", {
    maxDiffPixelRatio: 0.02,
    // Mask the header timestamp / user menu if it contains volatile content
    mask: [page.locator("[data-testid='last-sync-time']")],
  });
});

// -----------------------------------------------------------------
// Lore detail page
// -----------------------------------------------------------------
test("visual: lore detail page (character)", async ({ page }) => {
  attachConsoleErrorCollector(page);
  await installPortalApiMocks(page, { notes: LORE_NOTES });

  await page.goto("/lore/vr-note-1");
  await page.waitForLoadState("networkidle");
  await freezeAnimations(page);
  await page.waitForFunction(() => document.fonts.ready);

  // Wait for the note title to be rendered
  await expect(page.getByText("Aria Vale").first()).toBeVisible();

  await expect(page).toHaveScreenshot("lore-detail-character.png", {
    maxDiffPixelRatio: 0.02,
    mask: [page.locator("time"), page.locator("[data-testid='last-sync-time']")],
  });
});

// -----------------------------------------------------------------
// Lore detail page — location type
// -----------------------------------------------------------------
test("visual: lore detail page (location)", async ({ page }) => {
  attachConsoleErrorCollector(page);
  await installPortalApiMocks(page, { notes: LORE_NOTES });

  await page.goto("/lore/vr-note-2");
  await page.waitForLoadState("networkidle");
  await freezeAnimations(page);
  await page.waitForFunction(() => document.fonts.ready);

  await expect(page.getByText("Aether Keep").first()).toBeVisible();

  await expect(page).toHaveScreenshot("lore-detail-location.png", {
    maxDiffPixelRatio: 0.02,
    mask: [page.locator("time"), page.locator("[data-testid='last-sync-time']")],
  });
});

// -----------------------------------------------------------------
// New Lore page — blank slate
// -----------------------------------------------------------------
test("visual: new lore page (blank)", async ({ page }) => {
  attachConsoleErrorCollector(page);
  await installPortalApiMocks(page, { notes: LORE_NOTES });

  await page.goto("/lore/new");
  await page.waitForLoadState("networkidle");
  await freezeAnimations(page);
  await page.waitForFunction(() => document.fonts.ready);

  await expect(page.getByRole("button", { name: /choose a template/i })).toBeVisible();

  await expect(page).toHaveScreenshot("lore-new-blank.png", { maxDiffPixelRatio: 0.02 });
});

// -----------------------------------------------------------------
// New Lore page — template picker dialog open
// -----------------------------------------------------------------
test("visual: template picker dialog", async ({ page }) => {
  attachConsoleErrorCollector(page);
  await installPortalApiMocks(page, { notes: LORE_NOTES });

  await page.goto("/lore/new");
  await page.waitForLoadState("networkidle");
  await freezeAnimations(page);
  await page.waitForFunction(() => document.fonts.ready);

  await page.getByRole("button", { name: /choose a template/i }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  // Wait for template cards to render — use h3 locator to avoid strict-mode violations
  await expect(dialog.locator("h3", { hasText: "Character" })).toBeVisible();

  await expect(page).toHaveScreenshot("lore-new-template-picker.png", { maxDiffPixelRatio: 0.02 });
});

// -----------------------------------------------------------------
// New Lore page — after selecting a template (sidebar promoted fields)
// -----------------------------------------------------------------
test("visual: new lore page after selecting character template", async ({ page }) => {
  attachConsoleErrorCollector(page);
  await installPortalApiMocks(page, { notes: LORE_NOTES });

  await page.goto("/lore/new");
  await page.waitForLoadState("networkidle");
  await freezeAnimations(page);
  await page.waitForFunction(() => document.fonts.ready);

  await page.getByRole("button", { name: /choose a template/i }).click();
  await page.getByRole("dialog").locator("h3", { hasText: "Character" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByLabel(/^race$/i)).toBeVisible();

  await expect(page).toHaveScreenshot("lore-new-character-template-selected.png", {
    maxDiffPixelRatio: 0.02,
  });
});

// -----------------------------------------------------------------
// Lore editor (edit mode)
// -----------------------------------------------------------------
test("visual: lore editor page", async ({ page }) => {
  attachConsoleErrorCollector(page);
  await installPortalApiMocks(page, { notes: LORE_NOTES });

  await page.goto("/lore/vr-note-1/edit");
  await page.waitForLoadState("networkidle");
  await freezeAnimations(page);
  await page.waitForFunction(() => document.fonts.ready);

  // Wait for the BlockNote editor to mount
  await expect(page.locator(".bn-editor")).toBeVisible();

  await expect(page).toHaveScreenshot("lore-editor.png", {
    maxDiffPixelRatio: 0.02,
    mask: [page.locator("time")],
  });
});
