import { NextRequest, NextResponse } from "next/server";
import { checkConsistency } from "@/lib/allknower-server";
import { getAkCreds } from "@/lib/get-creds";
import { handleRouteError, notConfigured } from "@/lib/route-error";

export async function POST(req: NextRequest) {
  try {
    const creds = await getAkCreds();
    if (!creds.url || !creds.token) return notConfigured("AllKnower");
    const { noteIds } = await req.json().catch(() => ({}));
    const result = await checkConsistency(creds, noteIds);
    return NextResponse.json(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
