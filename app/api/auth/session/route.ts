import { NextResponse } from "next/server";
import { getAllKnowerSession } from "@/lib/allknower-server";
import { getAkCreds } from "@/lib/get-creds";
import { handleRouteError } from "@/lib/route-error";

/**
 * Return authentication and session status for the AllKnower integration.
 *
 * If credentials are missing the response marks the user unauthenticated (`authenticated: false`, `user: null`, `session: null`). When credentials are present the response includes the fetched `user` and sets `authenticated` based on whether a session exists; `session` is `{ active: true }` when a session is present, otherwise `null`.
 *
 * @returns A NextResponse JSON body with `{ authenticated: boolean, user: any | null, session: { active: true } | null }`. On error, returns the response produced by `handleRouteError`.
 */
export async function GET() {
  try {
    const creds = await getAkCreds();
    if (!creds.url || !creds.token) {
      return NextResponse.json({ authenticated: false, user: null, session: null });
    }

    const session = await getAllKnowerSession(creds);
    return NextResponse.json({
      authenticated: Boolean(session.session),
      user: session.user,
      session: session.session ? { active: true } : null,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
