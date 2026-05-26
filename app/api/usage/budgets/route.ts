import { NextRequest, NextResponse } from "next/server";
import { getAkCreds } from "@/lib/get-creds";
import { handleRouteError, notConfigured } from "@/lib/route-error";
import { getUserBudget, putUserBudget } from "@/lib/allknower-server";

export async function GET() {
  try {
    const creds = await getAkCreds();
    if (!creds.url || !creds.token) return notConfigured("AllKnower");
    const result = await getUserBudget(creds);
    return NextResponse.json(result);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const creds = await getAkCreds();
    if (!creds.url || !creds.token) return notConfigured("AllKnower");
    const body = await req.json();
    await putUserBudget(creds, body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
