import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PREFIXES = [
  "/_next",
  "/favicon.ico",
  "/login",
  "/public",
  "/api/public",
  "/api/auth",
  "/api/config/status",
];

function isPublicPath(pathname: string): boolean {
  return pathname === "/" || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (isPublicPath(pathname)) return NextResponse.next();

  const hasToken = request.cookies.get("allknower_token")?.value;
  if (hasToken) return NextResponse.next();

  if (isApiPath(pathname)) {
    return NextResponse.json(
      { error: "LOGIN_REQUIRED", message: "Owner login required." },
      { status: 401 },
    );
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
