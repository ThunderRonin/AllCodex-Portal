import { NextRequest, NextResponse } from "next/server";
import { queryRag } from "@/lib/allknower-server";
import { getAkCreds } from "@/lib/get-creds";

export async function POST(req: NextRequest) {
  try {
    const creds = await getAkCreds();
    const { text, topK } = await req.json();
    const results = await queryRag(creds, text, topK ?? 10);
    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
