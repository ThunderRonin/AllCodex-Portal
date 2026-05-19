import { NextRequest, NextResponse } from "next/server";
import { connectAllCodexIntegration } from "@/lib/allknower-server";
import { getAkCreds } from "@/lib/get-creds";
import { handleRouteError, notConfigured, ServiceError } from "@/lib/route-error";

async function loginToCore(baseUrl: string, password: string): Promise<string> {
  const res = await fetch(`${baseUrl}/etapi/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ServiceError(
      "UNAUTHORIZED",
      401,
      `AllCodex login failed (${res.status})${body ? `: ${body}` : ""}`,
    );
  }

  const data = await res.json().catch(() => ({}));
  if (!data.authToken) {
    throw new ServiceError("SERVICE_ERROR", 502, "AllCodex did not return an ETAPI token.");
  }
  return data.authToken;
}

export async function POST(req: NextRequest) {
  try {
    const creds = await getAkCreds();
    if (!creds.url || !creds.token) return notConfigured("AllKnower");

    const { url, baseUrl, password, token } = await req.json().catch(() => ({}));
    const coreUrl = (baseUrl ?? url ?? "").trim().replace(/\/$/, "");
    if (!coreUrl || (!password && !token)) {
      return NextResponse.json(
        { error: "INVALID_REQUEST", message: "url and either password or token are required." },
        { status: 400 },
      );
    }

    try {
      const parsed = new URL(coreUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("invalid protocol");
      }
    } catch {
      return NextResponse.json(
        { error: "INVALID_REQUEST", message: "Invalid AllCodex URL." },
        { status: 400 },
      );
    }

    const finalToken = token || await loginToCore(coreUrl, password);
    const status = await connectAllCodexIntegration(creds, coreUrl, finalToken);
    return NextResponse.json({ ok: true, integration: status });
  } catch (err) {
    return handleRouteError(err);
  }
}
