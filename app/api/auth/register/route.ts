import { NextResponse } from "next/server";

/**
 * Handle POST requests to register a user with an AllKnower service.
 *
 * Attempts to read `url`, `email`, `password`, and `name` from the request body, validates required fields,
 * performs registration, and attaches AllKnower session cookies to the response.
 *
 * @param req - The incoming NextRequest whose JSON body should include `url`, `email`, `password`, and `name`
 * @returns A NextResponse containing either a 400 JSON error `{ error: "INVALID_REQUEST", message: "url, email, password and name are required." }`
 *          when validation fails, or `{ ok: true, user }` on success with session cookies set.
 */
export async function POST() {
  return NextResponse.json(
    { error: "FORBIDDEN", message: "Sign-up is disabled. Use the owner account." },
    { status: 403 },
  );
}
