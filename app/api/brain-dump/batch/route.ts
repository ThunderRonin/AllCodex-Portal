import { NextRequest, NextResponse } from "next/server";
import { getAkCreds } from "@/lib/get-creds";
import { handleRouteError, notConfigured } from "@/lib/route-error";
import { submitBrainDumpBatch } from "@/lib/allknower-server";

export async function POST(req: NextRequest) {
  try {
    const creds = await getAkCreds();
    if (!creds.url || !creds.token) return notConfigured("AllKnower");
    const { items } = await req.json();
    const result = await submitBrainDumpBatch(creds, items);
    return NextResponse.json(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
