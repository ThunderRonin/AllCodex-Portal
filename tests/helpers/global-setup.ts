/**
 * Playwright Global Setup — Ephemeral Test Account
 *
 * Runs once before the entire test suite when integration env is present.
 * 1. Registers a deterministic test account on AllKnower (better-auth).
 * 2. Signs in to obtain a Bearer token.
 * 3. Writes cookies to tests/helpers/.auth/storage-state.json so integration
 *    tests can load them via `storageState` without re-authenticating.
 *
 * The account uses a deterministic local-only password so reruns remain
 * stable even if Better Auth leaves the DB row behind.
 */

import { chromium, type FullConfig } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------

export const TEST_EMAIL = "test-runner@allcodex.internal";
export const STORAGE_STATE_PATH = path.resolve(
  __dirname,
  ".auth/storage-state.json"
);
const TEST_PASSWORD =
  process.env.PLAYWRIGHT_TEST_PASSWORD ??
  "allcodex-playwright-test-password"; // NOSONAR — test credential with env override, not a production secret

const ALLCODEX_URL = process.env.TEST_ALLCODEX_URL ?? "http://localhost:8080";
const ALLCODEX_ETAPI_TOKEN = process.env.TEST_ALLCODEX_ETAPI_TOKEN ?? "";

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

async function signUp(baseUrl: string, email: string, password: string): Promise<boolean> {
  const res = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: baseUrl,
    },
    body: JSON.stringify({ email, password, name: "Test Runner" }),
  });

  if (res.ok) return true;

  // 422 / 409 → account already exists — treat as success
  if (res.status === 422 || res.status === 409) return true;

  const body = await res.text().catch(() => "");
  console.warn(`[global-setup] sign-up returned ${res.status}: ${body}`);
  return false;
}

async function signIn(
  baseUrl: string,
  email: string,
  password: string
): Promise<string | null> {
  const res = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: baseUrl,
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[global-setup] sign-in failed ${res.status}: ${body}`);
    return null;
  }

  const token = res.headers.get("set-auth-token");
  if (!token) {
    console.error("[global-setup] sign-in succeeded but set-auth-token header is missing");
    return null;
  }

  return token;
}

async function connectAllCodex(
  allknowerUrl: string,
  bearerToken: string,
  coreUrl: string,
  etapiToken: string,
): Promise<boolean> {
  const res = await fetch(`${allknowerUrl}/integrations/allcodex/connect`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bearerToken}`,
    },
    body: JSON.stringify({ baseUrl: coreUrl, token: etapiToken }),
    signal: AbortSignal.timeout(8_000),
  });

  if (res.ok) return true;

  const body = await res.text().catch(() => "");
  console.warn(`[global-setup] AllCodex connect returned ${res.status}: ${body}`);
  return false;
}

// --------------------------------------------------------------------------
// Global Setup Entry Point
// --------------------------------------------------------------------------

export default async function globalSetup(config: FullConfig) {
  const allknowerUrl = process.env.TEST_ALLKNOWER_URL ?? "http://localhost:3001";
  const portalUrl =
    config.projects[0]?.use?.baseURL ?? "http://localhost:3000";

  // Skip auth setup when integration env is absent — mocked tests don't need it
  if (!process.env.TEST_OPENROUTER_API_KEY) {
    console.log("[global-setup] TEST_OPENROUTER_API_KEY not set — skipping auth setup");
    return;
  }

  // Probe AllKnower before attempting auth — skip gracefully if unreachable
  // (mocked E2E tests don't need a live backend)
  try {
    const probe = await fetch(`${allknowerUrl}/health`, { signal: AbortSignal.timeout(3_000) });
    if (!probe.ok) throw new Error(`health returned ${probe.status}`);
  } catch {
    console.warn("[global-setup] AllKnower unreachable — skipping auth setup (mocked tests will still run)");
    return;
  }

  const password = TEST_PASSWORD;

  // 1. Register the ephemeral account (idempotent — re-uses if it already exists)
  console.log(`[global-setup] Registering test account: ${TEST_EMAIL}`);
  await signUp(allknowerUrl, TEST_EMAIL, password);

  // 2. Sign in
  console.log("[global-setup] Signing in...");
  let token = await signIn(allknowerUrl, TEST_EMAIL, password);

  // Retry once in case the sign-up and sign-in raced on first boot.
  if (!token) {
    console.warn("[global-setup] Sign-in failed — retrying deterministic test credentials...");
    const signedUp = await signUp(allknowerUrl, TEST_EMAIL, TEST_PASSWORD);
    if (signedUp) {
      token = await signIn(allknowerUrl, TEST_EMAIL, TEST_PASSWORD);
    }
  }

  if (!token) {
    console.warn(
      "[global-setup] Failed to obtain bearer token after retry — integration tests will be skipped.\n" +
      "If needed: DELETE FROM \"user\" WHERE email = 'test-runner@allcodex.internal'; in the Postgres DB."
    );
    return;
  }

  // 3. Connect AllCodex Core so integration tests can reach ETAPI
  if (ALLCODEX_ETAPI_TOKEN) {
    console.log(`[global-setup] Connecting AllCodex Core (${ALLCODEX_URL})...`);
    const connected = await connectAllCodex(allknowerUrl, token, ALLCODEX_URL, ALLCODEX_ETAPI_TOKEN);
    if (!connected) {
      console.warn("[global-setup] AllCodex connect failed — integration tests that need Core will fail");
    }
  } else {
    console.warn("[global-setup] TEST_ALLCODEX_ETAPI_TOKEN not set — skipping AllCodex connect");
  }

  // 4. Build the Playwright storage state with the two cookies the portal expects
  const storageState = {
    cookies: [
      {
        name: "allknower_token",
        value: token,
        domain: "localhost",
        path: "/",
        expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
        httpOnly: true,
        secure: false,
        sameSite: "Lax" as const,
      },
      {
        name: "allknower_url",
        value: allknowerUrl,
        domain: "localhost",
        path: "/",
        expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
        httpOnly: true,
        secure: false,
        sameSite: "Lax" as const,
      },
    ],
    origins: [] as Array<{ origin: string; localStorage: Array<{ name: string; value: string }> }>,
  };

  const stateDir = path.dirname(STORAGE_STATE_PATH);
  if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true });

  fs.writeFileSync(STORAGE_STATE_PATH, JSON.stringify(storageState, null, 2), {
    mode: 0o600,
  });

  console.log(`[global-setup] Storage state written → ${STORAGE_STATE_PATH}`);
}
