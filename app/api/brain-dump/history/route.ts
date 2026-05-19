import { type NextRequest, NextResponse } from "next/server";
import { getBrainDumpHistory } from "@/lib/allknower-server";
import { getAkCreds } from "@/lib/get-creds";
import { handleRouteError, notConfigured } from "@/lib/route-error";

/**
 * Handle GET requests for AllKnower brain dump history.
 *
 * Reads an optional `cursor` query parameter from `req` to page results, fetches history using stored AllKnower credentials, and returns the history as JSON.
 *
 * @param req - Incoming request; may include a `cursor` query parameter for pagination
 * @returns A NextResponse containing the brain dump history as JSON, or a standardized configuration/error response
 */
export async function GET(req: NextRequest) {
  try {
    const creds = await getAkCreds();
    if (!creds.url || !creds.token) return notConfigured("AllKnower");
    const cursor = req.nextUrl.searchParams.get("cursor") ?? undefined;
    const result = await getBrainDumpHistory(creds, cursor);
    return NextResponse.json(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
