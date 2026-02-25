import { NextRequest, NextResponse } from "next/server";
import { queryRag } from "@/lib/allknower-server";

export async function POST(req: NextRequest) {
  try {
    const { text, topK } = await req.json();
    const results = await queryRag(text, topK ?? 10);
    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
