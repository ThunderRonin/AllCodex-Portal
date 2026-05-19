import { NextRequest, NextResponse } from "next/server";
import { registerAllKnower } from "@/lib/allknower-server";
import { handleRouteError } from "@/lib/route-error";
import { resolveAllKnowerUrl, setAllKnowerSessionCookies } from "@/app/api/auth/_shared";

/**
 * Handle user registration with AllKnower, set session cookies, and return the created user.
 *
 * Validates `url`, `email`, `name`, and `password` from the request JSON body. On success sets session cookies for the AllKnower instance and responds with the created user.
 *
 * @returns A NextResponse containing `{ ok: true, user }` on success; a 400 JSON response with `error: "INVALID_REQUEST"` when required fields are missing; otherwise the error response produced by the route error handler.
 */
export async function POST(req: NextRequest) {
    try {
        const { url, email, name, password } = await req.json().catch(() => ({}));
        const allknowerUrl = resolveAllKnowerUrl(url);
        if (!allknowerUrl || !email || !name || !password) {
            return NextResponse.json(
                { error: "INVALID_REQUEST", message: "url, email, name and password are required." },
                { status: 400 },
            );
        }
        const { token, user } = await registerAllKnower(allknowerUrl, email, password, name);
        const response = NextResponse.json({ ok: true, user });
        setAllKnowerSessionCookies(response, allknowerUrl, token);
        return response;
    } catch (err) {
        return handleRouteError(err);
    }
}
