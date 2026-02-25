import { NextRequest, NextResponse } from "next/server";
import { suggestRelationships } from "@/lib/allknower-server";
import { getAkCreds } from "@/lib/get-creds";

export async function POST(req: NextRequest) {
  try {
    const creds = await getAkCreds();
    const { text } = await req.json();
    const result = await suggestRelationships(creds, text);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
