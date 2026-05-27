import { NextRequest, NextResponse } from "next/server";
import { getEtapiCreds } from "@/lib/get-creds";
import { handleRouteError, notConfigured } from "@/lib/route-error";
import { getNoteRevisions } from "@/lib/etapi-server";

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const creds = await getEtapiCreds();
    if (!creds.url || !creds.token) return notConfigured("AllCodex");
    const { id } = await props.params;
    const revisions = await getNoteRevisions(creds, id);
    return NextResponse.json(revisions);
  } catch (err) {
    return handleRouteError(err);
  }
}
