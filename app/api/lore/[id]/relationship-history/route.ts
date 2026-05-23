import { NextRequest, NextResponse } from "next/server";
import { getAkCreds } from "@/lib/get-creds";
import { getRelationshipHistory } from "@/lib/allknower-server";
import { handleRouteError, notConfigured } from "@/lib/route-error";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const creds = await getAkCreds();
    if (!creds.url || !creds.token) return notConfigured("AllKnower");
    const { id } = await params;
    const limit = Number(req.nextUrl.searchParams.get("limit") ?? 20);
    const result = await getRelationshipHistory(creds, id, limit);
    return NextResponse.json(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
