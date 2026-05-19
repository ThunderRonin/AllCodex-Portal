import { test, expect } from "@playwright/test";
import { installPortalApiMocks } from "./helpers/mock-api";
import { attachConsoleErrorCollector, expectNoConsoleErrors } from "./helpers/test-utils";

test("submits a brain dump and shows loading plus results", async ({ page }) => {
  const errors = attachConsoleErrorCollector(page);
  await installPortalApiMocks(page, {
    brainDump: {
      delayMs: 250,
      body: {
        mode: "auto",
        summary: "Extracted the Vault Oath.",
        created: [{ noteId: "brain-1", title: "Vault Oath", type: "event", action: "created" }],
        updated: [],
        skipped: [],
      },
    },
  });

  await page.goto("/brain-dump");

  await page.getByPlaceholder(/write anything/i).fill("The wardens swore the Vault Oath beneath the moonwell.");
  await page.getByRole("button", { name: /process with allknower/i }).click();

  await expect(page.getByRole("button", { name: /processing/i })).toBeVisible();
  await expect(page.getByText("Extracted the Vault Oath.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Vault Oath/i })).toBeVisible();

  await expectNoConsoleErrors(errors);
});

test("shows a service error state when AllKnower is unavailable for brain dump", async ({ page }) => {
  const errors = attachConsoleErrorCollector(page);
  await installPortalApiMocks(page, {
    brainDump: {
      status: 503,
      body: { error: "UNREACHABLE", message: "AllKnower unavailable" },
    },
  });

  await page.goto("/brain-dump");
  await page.getByPlaceholder(/write anything/i).fill("A broken request should still show a service banner.");
  await page.getByRole("button", { name: /process with allknower/i }).click();

  await expect(page.getByText("AllKnower unavailable").first()).toBeVisible();
  await expect(errors.filter((error) => !error.includes("503 (Service Unavailable)"))).toHaveLength(0);
});

test("shows empty state when there is no brain-dump history", async ({ page }) => {
  const errors = attachConsoleErrorCollector(page);
  await installPortalApiMocks(page, { brainDumpHistory: [] });

  await page.goto("/brain-dump");

  // Page should render the history section header
  await expect(page.getByText(/recent history/i)).toBeVisible();
  // With no entries, an empty-state or no list items should be visible
  await expect(page.getByRole("link", { name: /brain-dump\//i })).toHaveCount(0);

  await expectNoConsoleErrors(errors);
});

test("renders history entries as links when history is populated", async ({ page }) => {
  const errors = attachConsoleErrorCollector(page);
  await installPortalApiMocks(page, {
    brainDumpHistory: [
      {
        id: "hist-e2e-1",
        rawText: "The Vault Oath was sworn.",
        summary: "Vault Oath event captured.",
        notesCreated: ["note-1"],
        notesUpdated: [],
        model: "gpt-4o-mini",
        tokensUsed: 88,
        createdAt: new Date(Date.now() - 3_600_000).toISOString(),
      },
      {
        id: "hist-e2e-2",
        rawText: "A second lore fragment.",
        summary: "Fragment captured.",
        notesCreated: [],
        notesUpdated: ["note-2"],
        model: "gpt-4o-mini",
        tokensUsed: 42,
        createdAt: new Date(Date.now() - 7_200_000).toISOString(),
      },
    ],
  });

  await page.goto("/brain-dump");

  // Both history summaries should appear
  await expect(page.getByText("Vault Oath event captured.").first()).toBeVisible();
  await expect(page.getByText("Fragment captured.").first()).toBeVisible();

  await expectNoConsoleErrors(errors);
});