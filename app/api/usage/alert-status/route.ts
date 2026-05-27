import { NextResponse } from "next/server";
import { getAkCreds } from "@/lib/get-creds";
import { handleRouteError, notConfigured } from "@/lib/route-error";
import { getUsageAlertStatus } from "@/lib/allknower-server";

export async function GET() {
  try {
    const creds = await getAkCreds();
    if (!creds.url || !creds.token) return notConfigured("AllKnower");
    const result = await getUsageAlertStatus(creds);
    return NextResponse.json(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
