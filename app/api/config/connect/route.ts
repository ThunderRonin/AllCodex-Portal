/**
 * POST /api/config/connect
 *
 * Saves AllCodex and/or AllKnower credentials as HTTP-only cookies.
 * The client passes pre-acquired tokens directly — no server-side validation here,
 * that's done via /api/config/status.
 *
 * Body shape:
 *   {
 *     allcodex?: { url: string; token: string }
 *     allknower?: { url: string; token: string }
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  // Only mark secure on HTTPS. For localhost this stays false.
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 30, // 30 days
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const jar = await cookies();
  const saved: string[] = [];

  if (body.allcodex?.url && body.allcodex?.token) {
    jar.set("allcodex_url", body.allcodex.url, COOKIE_OPTS);
    jar.set("allcodex_token", body.allcodex.token, COOKIE_OPTS);
    saved.push("allcodex");
  }

  if (body.allknower?.url && body.allknower?.token) {
    jar.set("allknower_url", body.allknower.url, COOKIE_OPTS);
    jar.set("allknower_token", body.allknower.token, COOKIE_OPTS);
    saved.push("allknower");
  }

  if (saved.length === 0) {
    return NextResponse.json({ error: "No valid credentials provided" }, { status: 400 });
  }

  return NextResponse.json({ saved });
}
