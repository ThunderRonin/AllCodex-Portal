import { NextRequest, NextResponse } from "next/server";
import { checkConsistency } from "@/lib/allknower-server";

export async function POST(req: NextRequest) {
  try {
    const { noteIds } = await req.json().catch(() => ({}));
    const result = await checkConsistency(noteIds);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
