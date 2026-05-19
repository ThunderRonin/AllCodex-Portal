import { NextResponse } from "next/server";
import { getGaps } from "@/lib/allknower-server";
import { getAkCreds } from "@/lib/get-creds";
import { handleRouteError, notConfigured } from "@/lib/route-error";

/**
 * Performs a gap scan using AllKnower credentials and returns the JSON response.
 *
 * Loads AllKnower credentials, validates that `url` and `token` are present, invokes the gap scan, and returns the scan result as a JSON NextResponse. If credentials are not configured or an error occurs, returns a standardized error response.
 *
 * @returns A NextResponse containing the gap scan result on success; a standardized error response when credentials are missing or an error occurs.
 */
async function handleGapScan() {
  try {
    const creds = await getAkCreds();
    if (!creds.url || !creds.token) return notConfigured("AllKnower");
    const result = await getGaps(creds);
    return NextResponse.json(result);
  } catch (err) {
    return handleRouteError(err);
  }
}

/**
 * Handle GET requests for gap scanning and return the scan result as a JSON response.
 *
 * @returns A JSON HTTP response containing the gap scan results, or an error response if the scan fails or the integration is not configured.
 */
export async function GET() {
  return handleGapScan();
}

/**
 * Handle POST requests to run an AllKnower gap scan and return its response.
 *
 * @returns A NextResponse containing the gap scan result as JSON, or a standardized error response if credentials are missing or an error occurs.
 */
export async function POST() {
  return handleGapScan();
}
