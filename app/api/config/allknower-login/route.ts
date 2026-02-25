/**
 * POST /api/config/allknower-login
 *
 * Signs in to AllKnower (better-auth) and stores the session token as a cookie.
 * Endpoint: POST {url}/api/auth/sign-in/email  →  { token: string, user: {...} }
 *
 * Body: { url: string; email: string; password: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 30,
};

export async function POST(req: NextRequest) {
  const { url, email, password } = await req.json().catch(() => ({}));

  if (!url || !email || !password) {
    return NextResponse.json({ error: "url, email and password are required" }, { status: 400 });
  }

  try {
    const res = await fetch(`${url}/api/auth/sign-in/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": url, // better-auth requires Origin to be present
      },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `AllKnower returned ${res.status}${body ? `: ${body}` : ""}` },
        { status: 401 }
      );
    }

    const data = await res.json();
    // better-auth returns { token } at the top level
    const token: string = data.token ?? data.session?.token;

    if (!token) {
      return NextResponse.json({ error: "No token in response" }, { status: 502 });
    }

    const jar = await cookies();
    jar.set("allknower_url", url, COOKIE_OPTS);
    jar.set("allknower_token", token, COOKIE_OPTS);

    return NextResponse.json({ ok: true, user: data.user ?? null });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
