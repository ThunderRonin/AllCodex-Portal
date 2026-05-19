/**
 * Server-only credential resolver.
 * v1 user Core credentials are resolved through AllKnower's internal
 * credential route. Environment fallback is retained only for explicit local
 * development when there is no signed-in AllKnower session.
 */

import { cookies } from "next/headers";
import { resolveAllCodexCredentials } from "./allknower-server";
import { ServiceError } from "./route-error";
import { validateAllKnowerUrl } from "./url-validation";

export interface EtapiCreds {
  url: string;
  token: string;
}

export interface AkCreds {
  url: string;
  token: string;
}

/**
 * Resolve ETAPI (AllCodex) credentials for server-side use.
 *
 * Attempts to derive per-user credentials from signed-in AllKnower session cookies and the
 * internal portal secret; falls back to environment-configured credentials for non-production
 * environments. In production, missing credentials result in empty values unless a per-user
 * token is present without the required portal secret (which is treated as a configuration error).
 *
 * @returns An object with `url` and `token` for ETAPI; each is an empty string when no valid credential is available.
 * @throws ServiceError with code `NOT_CONFIGURED` and HTTP status 503 when a per-user AllCodex token is present but `PORTAL_INTERNAL_SECRET` is not set in production.
 */
export async function getEtapiCreds(): Promise<EtapiCreds> {
  const jar = await cookies();
  const rawAllknowerUrl = jar.get("allknower_url")?.value ?? process.env.ALLKNOWER_URL ?? "";
  const allknowerToken = jar.get("allknower_token")?.value ?? "";
  const portalInternalSecret = process.env.PORTAL_INTERNAL_SECRET ?? "";

  let allknowerUrl = "";
  try {
    allknowerUrl = rawAllknowerUrl ? validateAllKnowerUrl(rawAllknowerUrl) : "";
  } catch {
    return { url: "", token: "" };
  }

  if (allknowerUrl && allknowerToken && portalInternalSecret) {
    const creds = await resolveAllCodexCredentials(
      { url: allknowerUrl, token: allknowerToken },
      portalInternalSecret,
    );
    return { url: creds.baseUrl, token: creds.token };
  }

  if (allknowerToken && !portalInternalSecret && process.env.NODE_ENV === "production") {
    throw new ServiceError(
      "NOT_CONFIGURED",
      503,
      "PORTAL_INTERNAL_SECRET is required to resolve per-user AllCodex credentials.",
    );
  }

  if (process.env.NODE_ENV === "production") {
    return { url: "", token: "" };
  }

  return {
    url: process.env.ALLCODEX_URL ?? "",
    token: process.env.ALLCODEX_ETAPI_TOKEN ?? "",
  };
}

/**
 * Resolve AllKnower (AK) service credentials from session cookies with environment fallbacks.
 *
 * Attempts to obtain the AK base URL from the `allknower_url` cookie (validated) or `ALLKNOWER_URL` env.
 * The bearer token is taken from the `allknower_token` cookie or falls back to `ALLKNOWER_BEARER_TOKEN`.
 * If URL validation fails or required credentials are missing in production, returns empty credentials.
 *
 * @returns An object with `url` set to the resolved AK base URL (or `""` if unavailable) and `token` set to the resolved bearer token (cookie, env fallback, or `""`).
 */
export async function getAkCreds(): Promise<AkCreds> {
  const jar = await cookies();
  const rawUrl = jar.get("allknower_url")?.value;
  const token = jar.get("allknower_token")?.value;

  if (process.env.NODE_ENV === "production" && !token) {
    return { url: "", token: "" };
  }

  let url = "";
  try {
    url = rawUrl ? validateAllKnowerUrl(rawUrl) : (process.env.ALLKNOWER_URL || "");
  } catch {
    return { url: "", token: "" };
  }

  return {
    url,
    token: token ?? process.env.ALLKNOWER_BEARER_TOKEN ?? "",
  };
}

export async function isEtapiConfigured(): Promise<boolean> {
  const creds = await getEtapiCreds();
  return Boolean(creds.url && creds.token);
}

export async function isAkConfigured(): Promise<boolean> {
  const creds = await getAkCreds();
  return Boolean(creds.url && creds.token);
}

export async function getLoreRootNoteId(): Promise<string> {
  const jar = await cookies();
  return (
    jar.get("lore_root_note_id")?.value ||
    process.env.LORE_ROOT_NOTE_ID ||
    "root"
  );
}
