import { test, expect } from "@playwright/test";
import { requireIntegrationEnv } from "../helpers/integration-guard";

requireIntegrationEnv();

test.describe("Live Integration: AI Tools", () => {
  test.setTimeout(180_000);

  test("runs the Consistency Checker against real LLM", async ({ page }) => {
    await page.goto("/ai/consistency");

    // Submit (just runs the check on the mock/live DB)
    await page.getByRole("button", { name: /run check/i }).click();

    // Wait for real LLM response — the consistency pipeline runs 4 RAG probes
    // + OpenRouter rerank + LLM analysis, which can take 60-120s total
    const resultsArea = page.locator(".bg-card").filter({ hasText: /Summary/i });
    await expect(resultsArea).toBeVisible({ timeout: 150_000 });
  });

  test("runs the Gap Detector against real LLM", async ({ page }) => {
    await page.goto("/ai/gaps");

    // Submit (scans the entire chronicle)
    await page.getByRole("button", { name: /scan for gaps/i }).click();

    // Wait for the scan to finish. Live output is nondeterministic:
    // success may render gap cards or a legitimate empty state.
    await expect(page.getByRole("button", { name: /re-scan chronicle/i })).toBeVisible({ timeout: 150_000 });

    const successState = page
      .locator(".border-l-4")
      .first()
      .or(page.getByText(/No gaps detected/i));
    await expect(successState).toBeVisible({ timeout: 15_000 });
  });
});
