import { NextRequest, NextResponse } from "next/server";
import { checkConsistency } from "@/lib/allknower-server";
import { getAkCreds } from "@/lib/get-creds";

export async function POST(req: NextRequest) {
  try {
    const creds = await getAkCreds();
    const { noteIds } = await req.json().catch(() => ({}));
    const result = await checkConsistency(creds, noteIds);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
