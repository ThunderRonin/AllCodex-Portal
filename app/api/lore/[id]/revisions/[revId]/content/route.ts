import { NextRequest, NextResponse } from "next/server";
import { getEtapiCreds } from "@/lib/get-creds";
import { handleRouteError, notConfigured } from "@/lib/route-error";
import { getRevisionContent } from "@/lib/etapi-server";

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string; revId: string }> }) {
  try {
    const creds = await getEtapiCreds();
    if (!creds.url || !creds.token) return notConfigured("AllCodex");
    const { revId } = await props.params;
    const content = await getRevisionContent(creds, revId);
    return new NextResponse(content, {
      headers: { "Content-Type": "text/html" },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
