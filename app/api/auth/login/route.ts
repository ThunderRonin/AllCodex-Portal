import { NextRequest, NextResponse } from "next/server";
import { loginAllKnower } from "@/lib/allknower-server";
import { handleRouteError } from "@/lib/route-error";
import { resolveAllKnowerUrl, setAllKnowerSessionCookies } from "../_shared";

/**
 * Handle POST login requests for AllKnower and set session cookies on successful authentication.
 *
 * Parses `url`, `email`, and `password` from the request body, validates inputs, performs authentication
 * against the resolved AllKnower URL, and attaches session cookies when authentication succeeds.
 *
 * @returns A NextResponse containing `{ ok: true, user }` on successful login; a JSON error response with
 * status 400 and `{ error: "INVALID_REQUEST", message: "url, email and password are required." }`
 * when required fields are missing; or an error response produced by the route error handler for other failures.
 */
export async function POST(req: NextRequest) {
  try {
    const { url, email, password } = await req.json().catch(() => ({}));
    const allknowerUrl = resolveAllKnowerUrl(url);

    if (!allknowerUrl || !email || !password) {
      return NextResponse.json(
        { error: "INVALID_REQUEST", message: "url, email and password are required." },
        { status: 400 },
      );
    }

    const { token, user } = await loginAllKnower(allknowerUrl, email, password);
    const response = NextResponse.json({ ok: true, user });
    setAllKnowerSessionCookies(response, allknowerUrl, token);
    return response;
  } catch (err) {
    return handleRouteError(err);
  }
}
