import { NextResponse } from "next/server";
import { deleteAllCodexIntegration } from "@/lib/allknower-server";
import { getAkCreds } from "@/lib/get-creds";
import { handleRouteError, notConfigured } from "@/lib/route-error";

/**
 * Remove the AllCodex integration from AllKnower.
 *
 * @returns A `NextResponse` containing the deletion result as JSON on success; if credentials are missing returns a not-configured response for AllKnower, and if an error occurs returns a standardized error response.
 */
export async function DELETE() {
  try {
    const creds = await getAkCreds();
    if (!creds.url || !creds.token) return notConfigured("AllKnower");

    const result = await deleteAllCodexIntegration(creds);
    return NextResponse.json(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
