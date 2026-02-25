import { NextResponse } from "next/server";
import { getBrainDumpHistory } from "@/lib/allknower-server";
import { getAkCreds } from "@/lib/get-creds";

export async function GET() {
  try {
    const creds = await getAkCreds();
    const history = await getBrainDumpHistory(creds);
    return NextResponse.json(history);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
