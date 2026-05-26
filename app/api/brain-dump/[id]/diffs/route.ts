import { NextRequest, NextResponse } from "next/server";
import { getAkCreds } from "@/lib/get-creds";
import { handleRouteError, notConfigured } from "@/lib/route-error";
import { getBrainDumpDiffs } from "@/lib/allknower-server";

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const creds = await getAkCreds();
    if (!creds.url || !creds.token) return notConfigured("AllKnower");
    const { id } = await props.params;
    const result = await getBrainDumpDiffs(creds, id);
    return NextResponse.json(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
