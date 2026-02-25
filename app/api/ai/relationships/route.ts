import { NextRequest, NextResponse } from "next/server";
import { suggestRelationships } from "@/lib/allknower-server";
import { getAkCreds } from "@/lib/get-creds";
import { handleRouteError, notConfigured } from "@/lib/route-error";

export async function POST(req: NextRequest) {
  try {
    const creds = await getAkCreds();
    if (!creds.url || !creds.token) return notConfigured("AllKnower");
    const { text } = await req.json();
    const result = await suggestRelationships(creds, text);
    return NextResponse.json(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
