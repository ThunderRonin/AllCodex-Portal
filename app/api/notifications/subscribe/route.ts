import { NextRequest, NextResponse } from "next/server";
import { subscribeNotifications } from "@/lib/allknower-server";
import { getAkCreds } from "@/lib/get-creds";
import { handleRouteError, notConfigured } from "@/lib/route-error";

export async function POST(req: NextRequest) {
  try {
    const creds = await getAkCreds();
    if (!creds.url || !creds.token) return notConfigured("AllKnower");
    const body = await req.json();
    const result = await subscribeNotifications(creds, body);
    return NextResponse.json(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
