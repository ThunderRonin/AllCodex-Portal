import { NextResponse } from "next/server";
import { getAkCreds } from "@/lib/get-creds";
import { getModelChains } from "@/lib/allknower-server";
import { handleRouteError, notConfigured } from "@/lib/route-error";

/**
 * Serve AllKnower model chains as a JSON response.
 *
 * Fetches AllKnower credentials and, if required fields are present, retrieves the available model chains and returns them as JSON. If credentials are missing, returns a not-configured response for AllKnower. Any runtime error is converted to a route error response.
 *
 * @returns A NextResponse containing the model chains as JSON, a not-configured response when credentials are incomplete, or an error response produced by the route error handler.
 */
export async function GET() {
  try {
    const creds = await getAkCreds();
    if (!creds.url || !creds.token) return notConfigured("AllKnower");
    const models = await getModelChains(creds);
    return NextResponse.json(models);
  } catch (err) {
    return handleRouteError(err);
  }
}
