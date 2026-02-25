import { NextRequest, NextResponse } from "next/server";
import { suggestRelationships } from "@/lib/allknower-server";

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    const result = await suggestRelationships(text);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
