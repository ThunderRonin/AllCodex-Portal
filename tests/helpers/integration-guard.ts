import { test } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const STORAGE_STATE_PATH = path.resolve(
  __dirname,
  ".auth/storage-state.json"
);

/**
 * Skips integration tests when the OpenRouter API key or the browser storage state is missing.
 *
 * Call at the top of each integration spec. Tests are skipped if:
 * - `TEST_OPENROUTER_API_KEY` is not set.
 * - the `.auth/storage-state.json` file does not exist (global setup did not run).
 */
export function requireIntegrationEnv() {
  test.skip(
    !process.env.TEST_OPENROUTER_API_KEY,
    "Skipped: TEST_OPENROUTER_API_KEY not set"
  );
  test.skip(
    !fs.existsSync(STORAGE_STATE_PATH),
    "Skipped: storage-state.json not found — run globalSetup first"
  );
}
