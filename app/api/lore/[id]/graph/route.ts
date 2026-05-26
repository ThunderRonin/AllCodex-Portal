import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAkCreds } from "@/lib/get-creds";
import { getRelationshipGraph } from "@/lib/allknower-server";
import { handleRouteError, notConfigured } from "@/lib/route-error";

const GraphQuerySchema = z.object({
  depth: z.coerce.number().int().positive().default(2),
  maxNodes: z.coerce.number().int().positive().default(50),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const creds = await getAkCreds();
    if (!creds.url || !creds.token) return notConfigured("AllKnower");

    const { id } = await params;
    const raw = {
      depth: req.nextUrl.searchParams.get("depth") ?? undefined,
      maxNodes: req.nextUrl.searchParams.get("maxNodes") ?? undefined,
    };
    const parsed = GraphQuerySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: parsed.error.issues },
        { status: 400 },
      );
    }

    const graph = await getRelationshipGraph(creds, id, parsed.data.depth, parsed.data.maxNodes);
    return NextResponse.json(graph);
  } catch (err) {
    return handleRouteError(err);
  }
}
