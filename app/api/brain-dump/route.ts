import { NextRequest, NextResponse } from "next/server";
import { runBrainDump } from "@/lib/allknower-server";
import { getAkCreds } from "@/lib/get-creds";
import { handleRouteError, notConfigured } from "@/lib/route-error";

/**
 * Handle POST requests to perform a brain dump from provided text and return the result as JSON.
 *
 * The request body must be JSON containing `rawText`, and may include `mode` and `model`.
 * If `mode` is omitted, it defaults to `"auto"`. Requires configured AllKnower credentials.
 *
 * @param req - Incoming Next.js request whose JSON body includes `rawText`, optional `mode`, and optional `model`
 * @returns A NextResponse containing the brain dump result as JSON, or an error response if configuration is missing or the operation fails
 */
export async function POST(req: NextRequest) {
  try {
    const creds = await getAkCreds();
    if (!creds.url || !creds.token) return notConfigured("AllKnower");
    const { rawText, mode, model } = await req.json();
    const result = await runBrainDump(creds, rawText, mode ?? "auto", model);
    return NextResponse.json(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
