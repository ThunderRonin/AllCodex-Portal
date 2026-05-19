import { NextRequest } from "next/server";
import { getAkCreds } from "@/lib/get-creds";
import { notConfigured } from "@/lib/route-error";
import { proxySSE } from "@/lib/sse-proxy";

/**
 * For POST requests, forwards the parsed JSON body to AllKnower's "/brain-dump/stream" SSE endpoint and streams the proxied Server-Sent Events back to the client.
 *
 * @param req - The incoming Next.js request whose JSON body will be forwarded to the proxied SSE endpoint
 * @returns A Response that streams SSE from the proxied AllKnower endpoint, or a not-configured response when AllKnower credentials are missing
 */
export async function POST(req: NextRequest) {
  const creds = await getAkCreds();
  if (!creds.url || !creds.token) return notConfigured("AllKnower");
  const body = await req.json();
  return proxySSE(creds, "/brain-dump/stream", body);
}
