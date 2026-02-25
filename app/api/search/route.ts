import { NextRequest, NextResponse } from "next/server";
import { searchNotes } from "@/lib/etapi-server";
import { queryRag } from "@/lib/allknower-server";

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q") ?? "";
    const mode = req.nextUrl.searchParams.get("mode") ?? "etapi"; // "etapi" | "rag"

    if (mode === "rag") {
      const chunks = await queryRag(q, 15);
      return NextResponse.json({ mode: "rag", results: chunks });
    }

    const notes = await searchNotes(q || "#lore");
    return NextResponse.json({ mode: "etapi", results: notes });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
