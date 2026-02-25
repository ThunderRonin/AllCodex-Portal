/**
 * Server-only credential resolver.
 * Reads connection settings from HTTP-only cookies (set by /api/config/connect).
 * Falls back to environment variables so existing .env.local configs still work.
 */

import { cookies } from "next/headers";

export interface EtapiCreds {
  url: string;
  token: string;
}

export interface AkCreds {
  url: string;
  token: string;
}

export async function getEtapiCreds(): Promise<EtapiCreds> {
  const jar = await cookies();
  return {
    url: jar.get("allcodex_url")?.value ?? process.env.ALLCODEX_URL ?? "",
    token: jar.get("allcodex_token")?.value ?? process.env.ALLCODEX_ETAPI_TOKEN ?? "",
  };
}

export async function getAkCreds(): Promise<AkCreds> {
  const jar = await cookies();
  return {
    url: jar.get("allknower_url")?.value ?? process.env.ALLKNOWER_URL ?? "",
    token: jar.get("allknower_token")?.value ?? process.env.ALLKNOWER_BEARER_TOKEN ?? "",
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
