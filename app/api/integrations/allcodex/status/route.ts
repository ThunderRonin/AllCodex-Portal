import { NextResponse } from "next/server";
import { getAllCodexIntegrationStatus } from "@/lib/allknower-server";
import { getAkCreds } from "@/lib/get-creds";
import { handleRouteError } from "@/lib/route-error";

/**
 * Handle GET requests for the AllCodex integration status.
 *
 * Retrieves stored API credentials and, if present, queries AllCodex for integration status.
 * If credentials are missing, responds indicating the service is not connected and not authenticated.
 * Any thrown error is converted into an appropriate HTTP response via the route error handler.
 *
 * @returns A NextResponse with JSON:
 * - `{ connected: false, authenticated: false }` when `creds.url` or `creds.token` are missing,
 * - the fetched integration status fields merged with `{ authenticated: true }` when credentials are valid,
 * - or an error response returned by `handleRouteError`.
 */
export async function GET() {
  try {
    const creds = await getAkCreds();
    if (!creds.url || !creds.token) {
      return NextResponse.json({ connected: false, authenticated: false });
    }

    const status = await getAllCodexIntegrationStatus(creds);
    return NextResponse.json({ ...status, authenticated: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
