import { test, expect } from "@playwright/test";
import { buildNote, installPortalApiMocks } from "./helpers/mock-api";
import { attachConsoleErrorCollector, expectNoConsoleErrors } from "./helpers/test-utils";

const NOTE_WITH_LORE_MENTIONS = buildNote({
  noteId: "note-1",
  title: "Aria Vale",
  attributes: [
    { attributeId: "attr-lore-note-1", name: "lore", value: "", type: "label" },
    { attributeId: "attr-type-note-1", name: "loreType", value: "character", type: "label" },
  ],
  // Content mentions Aether Keep and Northern Reaches — two potential autolinks
  content: "<h1>Aria Vale</h1><p>Aria Vale is the warden of Aether Keep in the Northern Reaches.</p>",
});

test("autolink dialog is not visible on page load", async ({ page }) => {
  const errors = attachConsoleErrorCollector(page);
  await installPortalApiMocks(page, { notes: [NOTE_WITH_LORE_MENTIONS] });

  await page.goto("/lore/note-1/edit");
  await expect(page.locator(".bn-editor")).toBeVisible();

  await expect(page.getByRole("dialog", { name: /autolink lore entries/i })).not.toBeVisible();

  await expectNoConsoleErrors(errors);
});

test("autolink dialog opens when triggered via custom event", async ({ page }) => {
  const errors = attachConsoleErrorCollector(page);
  await installPortalApiMocks(page, {
    notes: [NOTE_WITH_LORE_MENTIONS],
    autolinkMatches: [
      { term: "Aether Keep", noteId: "note-2", title: "Aether Keep" },
    ],
  });

  await page.goto("/lore/note-1/edit");
  await expect(page.locator(".bn-editor")).toBeVisible();

  // Dispatch the custom event that the slash command would emit
  await page.evaluate(() => {
    // The AutolinkerDialog listens for this event. We pass a minimal editor stub
    // that satisfies the scanning logic inside the handler.
    const fakeEditor = {
      blocksToHTMLLossy: () => "<p>Aether Keep is a fortress.</p>",
      document: [],
      tryParseHTMLToBlocks: (html: string) => [],
      replaceBlocks: () => {},
    };
    window.dispatchEvent(
      new CustomEvent("open-autolink-dialog", { detail: { editor: fakeEditor } })
    );
  });

  const dialog = page.getByRole("dialog", { name: /autolink lore entries/i });
  await expect(dialog).toBeVisible();

  await expectNoConsoleErrors(errors);
});

test("autolink dialog shows scanning state then matches", async ({ page }) => {
  const errors = attachConsoleErrorCollector(page);

  // Register the slow route BEFORE installPortalApiMocks so it takes precedence
  // (Playwright routes are matched last-registered-first)
  await installPortalApiMocks(page, { notes: [NOTE_WITH_LORE_MENTIONS] });

  // Override the autolink route with a delayed version
  await page.route("**/api/lore/autolink", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        matches: [
          { term: "Aether Keep", noteId: "note-2", title: "Aether Keep" },
          { term: "Aria Vale", noteId: "note-1", title: "Aria Vale" },
        ],
      }),
    });
  });
  await page.goto("/lore/note-1/edit");
  await expect(page.locator(".bn-editor")).toBeVisible();

  await page.evaluate(() => {
    const fakeEditor = {
      blocksToHTMLLossy: () => "<p>Aether Keep and Aria Vale.</p>",
      document: [],
      tryParseHTMLToBlocks: (_html: string) => [],
      replaceBlocks: () => {},
    };
    window.dispatchEvent(
      new CustomEvent("open-autolink-dialog", { detail: { editor: fakeEditor } })
    );
  });

  const dialog = page.getByRole("dialog", { name: /autolink lore entries/i });
  await expect(dialog).toBeVisible();

  // Scanning state
  await expect(dialog.getByText(/scanning lore records/i)).toBeVisible();

  // After data loads, matches appear
  await expect(dialog.getByText("Aether Keep")).toBeVisible({ timeout: 3000 });
  await expect(dialog.getByText("Aria Vale")).toBeVisible();

  await expectNoConsoleErrors(errors);
});

test("autolink dialog shows each match with a checked checkbox", async ({ page }) => {
  const errors = attachConsoleErrorCollector(page);
  await installPortalApiMocks(page, {
    notes: [NOTE_WITH_LORE_MENTIONS],
    autolinkMatches: [
      { term: "Aether Keep", noteId: "note-2", title: "Aether Keep" },
      { term: "Aria Vale", noteId: "note-1", title: "Aria Vale" },
    ],
  });

  await page.goto("/lore/note-1/edit");
  await expect(page.locator(".bn-editor")).toBeVisible();

  await page.evaluate(() => {
    const fakeEditor = {
      blocksToHTMLLossy: () => "<p>Aether Keep and Aria Vale.</p>",
      document: [],
      tryParseHTMLToBlocks: (_html: string) => [],
      replaceBlocks: () => {},
    };
    window.dispatchEvent(
      new CustomEvent("open-autolink-dialog", { detail: { editor: fakeEditor } })
    );
  });

  const dialog = page.getByRole("dialog", { name: /autolink lore entries/i });
  await expect(dialog.getByText("Aether Keep")).toBeVisible({ timeout: 3000 });

  // Both checkboxes should start checked
  const checkboxes = dialog.getByRole("checkbox");
  await expect(checkboxes).toHaveCount(2);
  for (const checkbox of await checkboxes.all()) {
    await expect(checkbox).toBeChecked();
  }

  await expectNoConsoleErrors(errors);
});

test("autolink dialog shows empty state when no matches are found", async ({ page }) => {
  const errors = attachConsoleErrorCollector(page);
  await installPortalApiMocks(page, {
    notes: [NOTE_WITH_LORE_MENTIONS],
    autolinkMatches: [], // No matches
  });

  await page.goto("/lore/note-1/edit");
  await expect(page.locator(".bn-editor")).toBeVisible();

  await page.evaluate(() => {
    const fakeEditor = {
      blocksToHTMLLossy: () => "<p>No lore mentions here.</p>",
      document: [],
      tryParseHTMLToBlocks: (_html: string) => [],
      replaceBlocks: () => {},
    };
    window.dispatchEvent(
      new CustomEvent("open-autolink-dialog", { detail: { editor: fakeEditor } })
    );
  });

  const dialog = page.getByRole("dialog", { name: /autolink lore entries/i });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/no matching unlinked lore entries/i)).toBeVisible({ timeout: 3000 });

  // Apply button should be disabled with no matches
  await expect(dialog.getByRole("button", { name: /apply autolinks/i })).toBeDisabled();

  await expectNoConsoleErrors(errors);
});

test("cancel button closes the autolink dialog without changes", async ({ page }) => {
  const errors = attachConsoleErrorCollector(page);
  await installPortalApiMocks(page, {
    notes: [NOTE_WITH_LORE_MENTIONS],
    autolinkMatches: [{ term: "Aether Keep", noteId: "note-2", title: "Aether Keep" }],
  });

  await page.goto("/lore/note-1/edit");
  await expect(page.locator(".bn-editor")).toBeVisible();

  await page.evaluate(() => {
    const fakeEditor = {
      blocksToHTMLLossy: () => "<p>Aether Keep.</p>",
      document: [],
      tryParseHTMLToBlocks: (_html: string) => [],
      replaceBlocks: () => {},
    };
    window.dispatchEvent(
      new CustomEvent("open-autolink-dialog", { detail: { editor: fakeEditor } })
    );
  });

  const dialog = page.getByRole("dialog", { name: /autolink lore entries/i });
  await expect(dialog.getByText("Aether Keep")).toBeVisible({ timeout: 3000 });

  await dialog.getByRole("button", { name: /cancel/i }).click();

  await expect(page.getByRole("dialog", { name: /autolink lore entries/i })).not.toBeVisible();

  await expectNoConsoleErrors(errors);
});

test("deselecting a match and clicking Apply skips that term", async ({ page }) => {
  const errors = attachConsoleErrorCollector(page);
  let replaceBlocksArgs: unknown[] = [];

  await installPortalApiMocks(page, {
    notes: [NOTE_WITH_LORE_MENTIONS],
    autolinkMatches: [
      { term: "Aether Keep", noteId: "note-2", title: "Aether Keep" },
      { term: "Aria Vale", noteId: "note-1", title: "Aria Vale" },
    ],
  });

  await page.goto("/lore/note-1/edit");
  await expect(page.locator(".bn-editor")).toBeVisible();

  await page.evaluate(() => {
    (window as Window & { __replaceBlocksCalls?: unknown[][] }).__replaceBlocksCalls = [];
    const fakeEditor = {
      blocksToHTMLLossy: () => "<p>Aether Keep and Aria Vale.</p>",
      document: [],
      tryParseHTMLToBlocks: (html: string) => [{ html }],
      replaceBlocks: (_current: unknown, blocks: unknown) => {
        (window as Window & { __replaceBlocksCalls?: unknown[][] }).__replaceBlocksCalls?.push(blocks as unknown[]);
      },
    };
    window.dispatchEvent(
      new CustomEvent("open-autolink-dialog", { detail: { editor: fakeEditor } })
    );
  });

  const dialog = page.getByRole("dialog", { name: /autolink lore entries/i });
  await expect(dialog.getByText("Aria Vale")).toBeVisible({ timeout: 3000 });

  // Uncheck "Aria Vale" (second checkbox)
  const checkboxes = dialog.getByRole("checkbox");
  await checkboxes.nth(1).click();
  await expect(checkboxes.nth(1)).not.toBeChecked();

  await dialog.getByRole("button", { name: /apply autolinks/i }).click();

  // Dialog closes
  await expect(page.getByRole("dialog", { name: /autolink lore entries/i })).not.toBeVisible();

  // replaceBlocks was called — verify the HTML passed to parser contains link for Aether Keep
  // but NOT for Aria Vale
  const calls = await page.evaluate(() =>
    (window as Window & { __replaceBlocksCalls?: unknown[][] }).__replaceBlocksCalls ?? []
  );
  expect(calls.length).toBeGreaterThan(0);
  const appliedBlocks = JSON.stringify(calls[0]);
  expect(appliedBlocks).toContain("note-2"); // Aether Keep noteId
  expect(appliedBlocks).not.toContain("note-1"); // Aria Vale noteId deselected

  await expectNoConsoleErrors(errors);
});
