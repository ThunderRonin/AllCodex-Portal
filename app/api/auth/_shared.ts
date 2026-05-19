import { NextResponse } from "next/server";
import { validateAllKnowerUrl } from "@/lib/url-validation";

export const AUTH_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 30,
};

/**
 * Resolve and validate the AllKnower URL from an explicit value or the environment.
 *
 * @param url - Optional raw input; if a non-empty trimmed string it will be used, otherwise the `ALLKNOWER_URL` environment variable is used
 * @returns The validated AllKnower URL string, or an empty string when no URL was provided
 */
export function resolveAllKnowerUrl(url?: unknown): string {
  const raw = typeof url === "string" && url.trim() ? url.trim() : process.env.ALLKNOWER_URL ?? "";
  if (!raw) return "";
  return validateAllKnowerUrl(raw);
}

/**
 * Stores AllKnower session cookies on the given NextResponse.
 *
 * Sets the `allknower_url` cookie to the provided AllKnower base URL and
 * the `allknower_token` cookie to the provided session token using shared
 * auth cookie options.
 *
 * @param response - The NextResponse to modify
 * @param url - The AllKnower base URL to store in the `allknower_url` cookie
 * @param token - The session token to store in the `allknower_token` cookie
 */
export function setAllKnowerSessionCookies(
  response: NextResponse,
  url: string,
  token: string,
) {
  response.cookies.set("allknower_url", url, AUTH_COOKIE_OPTS);
  response.cookies.set("allknower_token", token, AUTH_COOKIE_OPTS);
}

/**
 * Remove AllKnower session cookies from the provided response.
 *
 * Deletes the `allknower_token` and `allknower_url` cookies on the given `NextResponse`.
 *
 * @param response - The `NextResponse` whose cookies will be modified
 */
export function clearAllKnowerSessionCookies(response: NextResponse) {
  response.cookies.delete("allknower_token");
  response.cookies.delete("allknower_url");
}
