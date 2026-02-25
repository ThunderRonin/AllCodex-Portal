import { NextResponse } from "next/server";
import { getBrainDumpHistory } from "@/lib/allknower-server";

export async function GET() {
  try {
    const history = await getBrainDumpHistory();
    return NextResponse.json(history);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
