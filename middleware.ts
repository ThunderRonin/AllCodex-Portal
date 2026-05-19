import { NextRequest, NextResponse } from "next/server";

const ALLKNOWER_URL = process.env.ALLKNOWER_URL || "http://localhost:3001";
const PORTAL_INTERNAL_SECRET = process.env.PORTAL_INTERNAL_SECRET || "dev-portal-secret-32chars!!!";

const COOKIE_OPTS = {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
};

const PROVISION_COOLDOWN_SECONDS = 30;

/**
 * Auto-provisions an allknower token and URL when the `allknower_token` cookie is missing, with a short cooldown to avoid repeated attempts.
 *
 * @returns A NextResponse that continues request processing. On successful provisioning, sets `allknower_token` and `allknower_url` cookies using the module's cookie options. If provisioning fails or a cooldown is active, sets the `_ak_provision_attempted` cookie to enforce the cooldown.
 */
export async function middleware(request: NextRequest) {
    const hasToken = request.cookies.get("allknower_token")?.value;
    if (hasToken) return NextResponse.next();

    const cooldown = request.cookies.get("_ak_provision_attempted")?.value;
    if (cooldown) return NextResponse.next();

    if (!ALLKNOWER_URL || !PORTAL_INTERNAL_SECRET) {
        return NextResponse.next();
    }

    try {
        const res = await fetch(`${ALLKNOWER_URL}/internal/auto-provision`, {
            method: "POST",
            headers: {
                "X-Portal-Internal-Secret": PORTAL_INTERNAL_SECRET,
                "Content-Type": "application/json",
            },
            signal: AbortSignal.timeout(5_000),
        });

        if (!res.ok) {
            const response = NextResponse.next();
            response.cookies.set("_ak_provision_attempted", "1", {
                httpOnly: true,
                path: "/",
                maxAge: PROVISION_COOLDOWN_SECONDS,
            });
            return response;
        }

        const { token, url } = (await res.json()) as { token: string; url: string };

        const response = NextResponse.next();
        response.cookies.set("allknower_token", token, COOKIE_OPTS);
        response.cookies.set("allknower_url", url, COOKIE_OPTS);
        return response;
    } catch {
        const response = NextResponse.next();
        response.cookies.set("_ak_provision_attempted", "1", {
            httpOnly: true,
            path: "/",
            maxAge: PROVISION_COOLDOWN_SECONDS,
        });
        return response;
    }
}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|api/auth|api/config/status).*)",
    ],
};
