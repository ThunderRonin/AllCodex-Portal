import { NextRequest, NextResponse } from "next/server";
import { registerAllKnower } from "@/lib/allknower-server";
import { handleRouteError } from "@/lib/route-error";
import { resolveAllKnowerUrl, setAllKnowerSessionCookies } from "@/app/api/auth/_shared";

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
