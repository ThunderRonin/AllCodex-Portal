import { NextResponse } from "next/server";

/**
 * Reject POST requests to the legacy AllKnower registration configuration endpoint.
 *
 * @returns A 403 JSON response because sign-up is disabled in owner-gated mode.
 */
export async function POST() {
  return NextResponse.json(
    { error: "FORBIDDEN", message: "Sign-up is disabled. Use the owner account." },
    { status: 403 },
  );
}
