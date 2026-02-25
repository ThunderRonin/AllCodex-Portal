import { NextResponse } from "next/server";
import { getBrainDumpHistory } from "@/lib/allknower-server";
import { getAkCreds } from "@/lib/get-creds";
import { handleRouteError, notConfigured } from "@/lib/route-error";

export async function GET() {
  try {
    const creds = await getAkCreds();
    if (!creds.url || !creds.token) return notConfigured("AllKnower");
    const history = await getBrainDumpHistory(creds);
    return NextResponse.json(history);
  } catch (err) {
    return handleRouteError(err);
  }
}
