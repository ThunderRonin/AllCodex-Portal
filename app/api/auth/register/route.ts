import { NextResponse } from "next/server";

/**
 * Reject POST requests to the legacy Portal self-service registration endpoint.
 *
 * @returns A 403 JSON response because only the configured owner account can access writer tools.
 */
export async function POST() {
  return NextResponse.json(
    { error: "FORBIDDEN", message: "Sign-up is disabled. Use the owner account." },
    { status: 403 },
  );
}
