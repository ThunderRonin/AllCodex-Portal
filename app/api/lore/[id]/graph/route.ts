import { NextRequest, NextResponse } from "next/server";
import { getAkCreds } from "@/lib/get-creds";
import { getRelationshipGraph } from "@/lib/allknower-server";
import { handleRouteError, notConfigured } from "@/lib/route-error";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const creds = await getAkCreds();
    if (!creds.url || !creds.token) return notConfigured("AllKnower");

    const { id } = await params;
    const depth = Number(req.nextUrl.searchParams.get("depth") ?? 2);
    const maxNodes = Number(req.nextUrl.searchParams.get("maxNodes") ?? 50);

    const graph = await getRelationshipGraph(creds, id, depth, maxNodes);
    return NextResponse.json(graph);
  } catch (err) {
    return handleRouteError(err);
  }
}
