import { NextRequest, NextResponse } from "next/server";
import { queryRag } from "@/lib/allknower-server";
import { getAkCreds } from "@/lib/get-creds";
import { handleRouteError, notConfigured } from "@/lib/route-error";

export async function POST(req: NextRequest) {
  try {
    const creds = await getAkCreds();
    if (!creds.url || !creds.token) return notConfigured("AllKnower");
    const { text, topK } = await req.json();
    const results = await queryRag(creds, text, topK ?? 10);
    return NextResponse.json({ results });
  } catch (err) {
    return handleRouteError(err);
  }
}
