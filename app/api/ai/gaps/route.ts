import { NextResponse } from "next/server";
import { getGaps } from "@/lib/allknower-server";

export async function GET() {
  try {
    const result = await getGaps();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
