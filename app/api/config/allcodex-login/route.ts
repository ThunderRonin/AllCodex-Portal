/**
 * POST /api/config/allcodex-login
 *
 * Uses Trilium ETAPI password-based authentication to obtain a token dynamically.
 * Trilium endpoint: POST {url}/etapi/auth/login  →  { authToken: string }
 *
 * Body: { url: string; password: string }
 *
 * On success: saves the token as an HTTP-only cookie and returns { ok: true }.
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
  const { url, password } = await req.json().catch(() => ({}));

  if (!url || !password) {
    return NextResponse.json({ error: "url and password are required" }, { status: 400 });
  }

  try {
    const res = await fetch(`${url}/etapi/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `Trilium returned ${res.status}${body ? `: ${body}` : ""}` },
        { status: 401 }
      );
    }

    const data = await res.json();
    const token: string = data.authToken;

    if (!token) {
      return NextResponse.json({ error: "No authToken in response" }, { status: 502 });
    }

    const jar = await cookies();
    jar.set("allcodex_url", url, COOKIE_OPTS);
    jar.set("allcodex_token", token, COOKIE_OPTS);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
