import { NextRequest, NextResponse } from "next/server";
import { runBrainDump } from "@/lib/allknower-server";
import { getAkCreds } from "@/lib/get-creds";

export async function POST(req: NextRequest) {
  try {
    const creds = await getAkCreds();
    const { rawText } = await req.json();
    const result = await runBrainDump(creds, rawText);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
