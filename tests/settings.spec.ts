import { test, expect } from "@playwright/test";
import { installPortalApiMocks } from "./helpers/mock-api";
import { attachConsoleErrorCollector, expectNoConsoleErrors } from "./helpers/test-utils";

/** Override the config/status route to return disconnected state.
 *  Must be called AFTER installPortalApiMocks because Playwright uses LIFO for route matching. */
async function setDisconnected(page: import("@playwright/test").Page) {
  await page.route("**/api/config/status**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        allcodex: { ok: false, configured: false, url: "http://localhost:8080" },
        allknower: { ok: false, configured: false, url: "http://localhost:3001" },
      }),
    });
  });
}

test("renders AllCodex and AllKnower status cards", async ({ page }) => {
  const errors = attachConsoleErrorCollector(page);
  await installPortalApiMocks(page);

  await page.goto("/settings");

  await expect(page.getByText(/allcodex/i).first()).toBeVisible();
  await expect(page.getByText(/allknower/i).first()).toBeVisible();
  await expectNoConsoleErrors(errors);
});

test("ETAPI token connect flow calls POST /api/integrations/allcodex/connect", async ({ page }) => {
  const errors = attachConsoleErrorCollector(page);
  await installPortalApiMocks(page);
  await setDisconnected(page);

  const connectCalled = { value: false };
  await page.route("**/api/integrations/allcodex/connect", async (route) => {
    connectCalled.value = true;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
  });

  await page.goto("/settings");

  // Forms are behind "Advanced / Override" toggle — click it on AllCodex card
  const allcodexCard = page.locator("text=Trilium notes — ETAPI").locator("..").locator("..").locator("..").locator("..");
  await allcodexCard.getByText("Advanced / Override").click();

  await page.locator("#allcodex-token").fill("test-token-abc");
  await allcodexCard.getByRole("button", { name: /^connect$/i }).click();

  expect(connectCalled.value).toBe(true);
  await expectNoConsoleErrors(errors);
});

test("AllCodex password login flow calls POST /api/config/allknower-login", async ({ page }) => {
  const errors = attachConsoleErrorCollector(page);
  await installPortalApiMocks(page);
  await setDisconnected(page);

  const loginCalled = { value: false };
  await page.route("**/api/config/allknower-login", async (route) => {
    loginCalled.value = true;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
  });

  await page.goto("/settings");

  // Open Advanced / Override on AllCodex card
  const allcodexCard = page.locator("text=Trilium notes — ETAPI").locator("..").locator("..").locator("..").locator("..");
  await allcodexCard.getByText("Advanced / Override").click();

  // Switch to Password Login tab
  await page.getByRole("tab", { name: /password login/i }).click();
  await page.locator("#allcodex-password").fill("my-password");
  await allcodexCard.getByRole("button", { name: /login & connect/i }).click();

  expect(loginCalled.value).toBe(true);
  await expectNoConsoleErrors(errors);
});

test("AllKnower register mode calls POST /api/auth/register", async ({ page }) => {
  const errors = attachConsoleErrorCollector(page);
  await installPortalApiMocks(page);
  await setDisconnected(page);

  const registerCalled = { value: false };
  await page.route("**/api/auth/register", async (route) => {
    registerCalled.value = true;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });

  await page.goto("/settings");

  // Open Advanced / Override on AllKnower card
  const allknowerCard = page.locator("text=AI knowledge service").locator("..").locator("..").locator("..").locator("..");
  await allknowerCard.getByText("Advanced / Override").click();

  // Click Register button in idle mode to switch to register form
  await allknowerCard.getByRole("button", { name: /^register$/i }).click();

  // Fill register form fields
  await page.locator("#ak-reg-name").fill("Test User");
  await page.locator("#ak-reg-email").fill("test@example.com");
  await page.locator("#ak-reg-password").fill("password123");

  // Submit the register form (the Register button in register mode)
  await allknowerCard.getByRole("button", { name: /^register$/i }).click();

  expect(registerCalled.value).toBe(true);
  await expectNoConsoleErrors(errors);
});

test("Disconnect AllCodex calls DELETE /api/integrations/allcodex", async ({ page }) => {
  const errors = attachConsoleErrorCollector(page);
  await installPortalApiMocks(page);
  // Default mock has ok: true → connected state

  const disconnectCalled = { value: false };
  await page.route("**/api/integrations/allcodex", async (route) => {
    if (route.request().method() === "DELETE") {
      disconnectCalled.value = true;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
      return;
    }
    await route.fallback();
  });

  await page.goto("/settings");

  // Disconnect is behind Advanced / Override, only visible when connected
  const allcodexCard = page.locator("text=Trilium notes — ETAPI").locator("..").locator("..").locator("..").locator("..");
  await allcodexCard.getByText("Advanced / Override").click();
  await allcodexCard.getByRole("button", { name: /^disconnect$/i }).click();

  expect(disconnectCalled.value).toBe(true);
  await expectNoConsoleErrors(errors);
});
