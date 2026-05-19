/**
 * Playwright Global Teardown — Ephemeral Test Account Cleanup
 *
 * Runs once after the entire test suite.
 * 1. Reads the stored bearer token.
 * 2. Calls DELETE /api/auth/delete-user on AllKnower to remove the account.
 * 3. Removes the local storage-state.json so the next run starts clean.
 */

import * as fs from "fs";
import * as path from "path";

// Mirrors the constant in global-setup.ts — kept local to avoid a .ts import
const STORAGE_STATE_PATH = path.resolve(
  __dirname,
  ".auth/storage-state.json"
);

/**
 * Delete the test user account associated with the provided bearer token on the AllKnower service.
 *
 * @param allknowerUrl - Base URL of the AllKnower instance (e.g., "http://localhost:3001")
 * @param token - Bearer token identifying the account to delete
 */
async function deleteAccount(allknowerUrl: string, token: string): Promise<void> {
  const res = await fetch(`${allknowerUrl}/api/auth/delete-user`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      Origin: allknowerUrl,
    },
  });

  if (res.ok) {
    console.log("[global-teardown] Test account deleted successfully");
    return;
  }

  const body = await res.text().catch(() => "");
  console.warn(
    `[global-teardown] delete-user returned ${res.status} — account may already be gone: ${body}`
  );
}

/**
 * Playwright global teardown that removes the ephemeral test account and cleans up local storage state.
 *
 * If `TEST_OPENROUTER_API_KEY` is not set, the function exits without performing any teardown.
 * Otherwise it attempts to extract a bearer token from the file referenced by `STORAGE_STATE_PATH`; if a token is found it calls the AllKnower account-deletion endpoint at `TEST_ALLKNOWER_URL` (defaults to `http://localhost:3001`). Afterward, it removes the local storage state file if present. The function logs warnings when the storage state cannot be parsed, when no token is found, or when account deletion fails.
 */
export default async function globalTeardown() {
  const allknowerUrl = process.env.TEST_ALLKNOWER_URL ?? "http://localhost:3001";

  if (!process.env.TEST_OPENROUTER_API_KEY) {
    return; // nothing was set up, nothing to tear down
  }

  // Read bearer token from storage state
  let token: string | null = null;
  if (fs.existsSync(STORAGE_STATE_PATH)) {
    try {
      const state = JSON.parse(fs.readFileSync(STORAGE_STATE_PATH, "utf-8"));
      const cookie = (state.cookies as Array<{ name: string; value: string }>).find(
        (c) => c.name === "allknower_token"
      );
      token = cookie?.value ?? null;
    } catch {
      console.warn("[global-teardown] Could not parse storage state");
    }
  }

  // Delete the account if we have a valid token
  if (token) {
    try {
      await deleteAccount(allknowerUrl, token);
    } catch {
      console.warn("[global-teardown] AllKnower unreachable — skipping account deletion");
    }
  } else {
    console.warn("[global-teardown] No bearer token found — skipping account deletion");
  }

  if (fs.existsSync(STORAGE_STATE_PATH)) {
    fs.rmSync(STORAGE_STATE_PATH);
    console.log(`[global-teardown] Removed: ${STORAGE_STATE_PATH}`);
  }
}
