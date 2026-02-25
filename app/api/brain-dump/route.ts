import { NextRequest, NextResponse } from "next/server";
import { runBrainDump } from "@/lib/allknower-server";

export async function POST(req: NextRequest) {
  try {
    const { rawText } = await req.json();
    const result = await runBrainDump(rawText);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
