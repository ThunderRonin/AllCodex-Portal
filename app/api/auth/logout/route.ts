import { NextResponse } from "next/server";
import { logoutAllKnower } from "@/lib/allknower-server";
import { getAkCreds } from "@/lib/get-creds";
import { clearAllKnowerSessionCookies } from "../_shared";

/**
 * Handle logout by attempting to revoke the AllKnower session and clearing local Knower cookies.
 *
 * Fetches AK credentials and, if both `url` and `token` are present, calls `logoutAllKnower` (any errors are suppressed). Returns a JSON response `{ ok: true }` and clears all Knower session cookies on that response.
 *
 * @returns A NextResponse containing `{ ok: true }` with Knower session cookies removed.
 */
export async function POST() {
  const creds = await getAkCreds();
  if (creds.url && creds.token) {
    await logoutAllKnower(creds).catch(() => undefined);
  }

  const response = NextResponse.json({ ok: true });
  clearAllKnowerSessionCookies(response);
  return response;
}
