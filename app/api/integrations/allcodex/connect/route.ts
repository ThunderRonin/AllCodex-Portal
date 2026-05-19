import { NextRequest, NextResponse } from "next/server";
import { connectAllCodexIntegration } from "@/lib/allknower-server";
import { getAkCreds } from "@/lib/get-creds";
import { handleRouteError, notConfigured, ServiceError } from "@/lib/route-error";

/**
 * Obtain an ETAPI authentication token from an AllCodex core instance.
 *
 * @param baseUrl - Base URL of the AllCodex core (no trailing slash required)
 * @param password - Password to authenticate against the core's ETAPI login endpoint
 * @returns The `authToken` string returned by the core
 * @throws ServiceError with code `"UNAUTHORIZED"` and HTTP status `401` if the login request fails (response not OK)
 * @throws ServiceError with code `"SERVICE_ERROR"` and HTTP status `502` if the response does not contain an `authToken`
 */
async function loginToCore(baseUrl: string, password: string): Promise<string> {
  const res = await fetch(`${baseUrl}/etapi/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ServiceError(
      "UNAUTHORIZED",
      401,
      `AllCodex login failed (${res.status})${body ? `: ${body}` : ""}`,
    );
  }

  const data = await res.json().catch(() => ({}));
  if (!data.authToken) {
    throw new ServiceError("SERVICE_ERROR", 502, "AllCodex did not return an ETAPI token.");
  }
  return data.authToken;
}

/**
 * Handles POST requests to connect an AllCodex integration by validating input, obtaining a core token, and creating the integration.
 *
 * Expects a JSON body with optional `url`, `baseUrl`, `password`, and `token`. Requires a resolved core URL (from `baseUrl` or `url`) and either `password` or `token`. Uses stored AllKnower credentials; returns a not-configured response if those credentials are missing.
 *
 * @param req - The incoming NextRequest whose JSON body may contain `url`, `baseUrl`, `password`, and `token`
 * @returns On success, a JSON response `{ ok: true, integration: status }` describing the created/updated integration; on invalid input, a 400 JSON response `{ error: "INVALID_REQUEST", message: "url and either password or token are required." }`; other error responses are returned for authentication or service failures.
 */
export async function POST(req: NextRequest) {
  try {
    const creds = await getAkCreds();
    if (!creds.url || !creds.token) return notConfigured("AllKnower");

    const { url, baseUrl, password, token } = await req.json().catch(() => ({}));
    const coreUrl = (baseUrl ?? url ?? "").trim().replace(/\/$/, "");
    if (!coreUrl || (!password && !token)) {
      return NextResponse.json(
        { error: "INVALID_REQUEST", message: "url and either password or token are required." },
        { status: 400 },
      );
    }

    const finalToken = token || await loginToCore(coreUrl, password);
    const status = await connectAllCodexIntegration(creds, coreUrl, finalToken);
    return NextResponse.json({ ok: true, integration: status });
  } catch (err) {
    return handleRouteError(err);
  }
}
