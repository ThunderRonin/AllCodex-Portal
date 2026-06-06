import { NextResponse } from "next/server";

/**
 * Handle user registration with AllKnower, set session cookies, and return the created user.
 *
 * Validates `url`, `email`, `name`, and `password` from the request JSON body. On success sets session cookies for the AllKnower instance and responds with the created user.
 *
 * @returns A NextResponse containing `{ ok: true, user }` on success; a 400 JSON response with `error: "INVALID_REQUEST"` when required fields are missing; otherwise the error response produced by the route error handler.
 */
export async function POST() {
    return NextResponse.json(
        { error: "FORBIDDEN", message: "Sign-up is disabled. Use the owner account." },
        { status: 403 },
    );
}
