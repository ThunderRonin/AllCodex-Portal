import { NextRequest, NextResponse } from "next/server";
import { getAkCreds } from "@/lib/get-creds";
import { handleRouteError, notConfigured } from "@/lib/route-error";
import { getUsageSummary } from "@/lib/allknower-server";

export async function GET(req: NextRequest) {
  try {
    const creds = await getAkCreds();
    if (!creds.url || !creds.token) return notConfigured("AllKnower");
    const from = req.nextUrl.searchParams.get("from") ?? undefined;
    const to = req.nextUrl.searchParams.get("to") ?? undefined;
    const result = await getUsageSummary(creds, from, to);
    return NextResponse.json(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
