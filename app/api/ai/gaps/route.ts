import { NextResponse } from "next/server";
import { getGaps } from "@/lib/allknower-server";
import { getAkCreds } from "@/lib/get-creds";

export async function GET() {
  try {
    const creds = await getAkCreds();
    const result = await getGaps(creds);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
