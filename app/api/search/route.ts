import { NextRequest, NextResponse } from "next/server";
import { searchNotes } from "@/lib/etapi-server";
import { queryRag } from "@/lib/allknower-server";
import { getEtapiCreds, getAkCreds } from "@/lib/get-creds";
import { handleRouteError, notConfigured } from "@/lib/route-error";

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q") ?? "";
    const mode = req.nextUrl.searchParams.get("mode") ?? "etapi"; // "etapi" | "rag"

    if (mode === "rag") {
      const creds = await getAkCreds();
      if (!creds.url || !creds.token) return notConfigured("AllKnower");
      const chunks = await queryRag(creds, q, 15);
      return NextResponse.json({ mode: "rag", results: chunks });
    }

    const creds = await getEtapiCreds();
    if (!creds.url || !creds.token) return notConfigured("AllCodex");
    const notes = await searchNotes(creds, q || "#lore");
    return NextResponse.json({ mode: "etapi", results: notes });
  } catch (err) {
    return handleRouteError(err);
  }
}
