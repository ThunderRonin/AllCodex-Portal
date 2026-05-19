import { defineConfig, devices } from "@playwright/test";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: ".env.test" });

const STORAGE_STATE = path.resolve(
  __dirname,
  "tests/helpers/.auth/storage-state.json"
);

export default defineConfig({
  testDir: "./tests",
  snapshotDir: "./tests/snapshots",
  timeout: 30_000,
  fullyParallel: true,
  workers: 1,
  retries: 0,
  outputDir: "tests/test-results/artifacts",
  reporter: [["list"]],

  // Ephemeral test account: created before suite, deleted after
  globalSetup: "./tests/helpers/global-setup.ts",
  globalTeardown: "./tests/helpers/global-teardown.ts",

  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
    },
  },
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "bun run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    cwd: __dirname,
    timeout: 120_000,
    gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
  },
  projects: [
    // ── Mocked / unit-level E2E ─────────────────────────────────────────────
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
      testIgnore: /tests\/integration\/.*/,
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
      testIgnore: /tests\/integration\/.*/,
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
      testIgnore: /tests\/integration\/.*/,
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
      testMatch: /mobile\.spec\.ts/,
    },

    // ── Live integration (needs real stack + OpenRouter key) ────────────────
    {
      name: "integration",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
        // Load the pre-authenticated session written by global-setup
        storageState: STORAGE_STATE,
      },
      testMatch: /tests\/integration\/.*/,
    },
  ],
});
