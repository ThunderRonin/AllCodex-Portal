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
/**
 * Attempts to create a test account using the service's email sign-up endpoint.
 *
 * Logs a warning with response status and body when the request fails.
 *
 * @returns `true` if the account was created or already exists (HTTP 200, 422, or 409), `false` otherwise.
 */

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

/**
 * Signs in to the given base URL using email and password and retrieves the auth token from the response header.
 *
 * @param baseUrl - Base URL of the server (e.g., "http://localhost:3000")
 * @param email - Account email to sign in
 * @param password - Account password to sign in
 * @returns The value of the `set-auth-token` response header if sign-in succeeded, `null` otherwise.
 */
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

/**
 * Attempts to register/connect an AllCodex Core instance with the AllKnower service.
 *
 * @param allknowerUrl - Base URL of the AllKnower service to call
 * @param bearerToken - Bearer token used to authorize the request to AllKnower
 * @param coreUrl - Base URL of the AllCodex Core instance to connect
 * @param etapiToken - ETAPI token presented to the Core during connection
 * @returns `true` if AllKnower returned a successful HTTP status, `false` otherwise
 */
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
/**
 * Prepare an ephemeral integration test account and emit a Playwright storage-state JSON for later tests.
 *
 * Performs idempotent account provisioning and sign-in against the AllKnower service, optionally connects AllCodex Core when an ETAPI token is provided, and writes a storage-state file containing the auth token and AllKnower URL cookies to STORAGE_STATE_PATH.
 *
 * The setup is skipped when the environment variable `TEST_OPENROUTER_API_KEY` is not set or when the AllKnower health check is unreachable; in those cases no storage-state file is produced. If token acquisition fails after a single retry, the function returns without writing auth state.
 *
 * @param config - Playwright `FullConfig` (used to derive project base URL if needed)
 */

export default async function globalSetup(config: FullConfig) {
  const allknowerUrl = process.env.TEST_ALLKNOWER_URL ?? "http://localhost:3001";
  const portalUrl =
    config.projects[0]?.use?.baseURL ?? "http://localhost:3000";

  const writeMockStorageState = () => {
    const mockStorageState = {
      cookies: [
        {
          name: "allknower_token",
          value: "test-owner-token",
          domain: "localhost",
          path: "/",
          expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
          httpOnly: true,
          secure: false,
          sameSite: "Lax" as const,
        },
        {
          name: "allknower_url",
          value: "http://localhost:3001",
          domain: "localhost",
          path: "/",
          expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
          httpOnly: true,
          secure: false,
          sameSite: "Lax" as const,
        },
      ],
      origins: [],
    };
    const stateDir = path.dirname(STORAGE_STATE_PATH);
    if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(STORAGE_STATE_PATH, JSON.stringify(mockStorageState, null, 2), {
      mode: 0o600,
    });
    console.log(`[global-setup] Mock storage state written → ${STORAGE_STATE_PATH}`);
  };

  // Write mock auth cookies when integration env is absent so mocked tests can run authenticated
  if (!process.env.TEST_OPENROUTER_API_KEY) {
    console.log("[global-setup] TEST_OPENROUTER_API_KEY not set — using mock auth");
    writeMockStorageState();
    return;
  }

  // Probe AllKnower before attempting auth — skip gracefully if unreachable.
  // Use /api/auth/ok instead of /health because /health returns 503 when
  // stored ETAPI creds are stale — but the setup itself fixes that (step 3).
  try {
    const probe = await fetch(`${allknowerUrl}/api/auth/ok`, { signal: AbortSignal.timeout(3_000) });
    if (!probe.ok) throw new Error(`auth probe returned ${probe.status}`);
  } catch {
    console.warn("[global-setup] AllKnower unreachable — fallback to mock storage state");
    writeMockStorageState();
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
