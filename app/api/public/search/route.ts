import { NextRequest, NextResponse } from "next/server";
import { fetchCoreShareRoot } from "@/lib/core-share-server";
import { handleRouteError, notConfigured } from "@/lib/route-error";

export async function GET(req: NextRequest) {
  try {
    const coreUrl = process.env.ALLCODEX_URL ?? "";
    if (!coreUrl) return notConfigured("AllCodex");

    const query = req.nextUrl.searchParams.get("q") ?? "";
    if (!query.trim()) {
      return NextResponse.json({ results: [] });
    }

    const rootNote = await fetchCoreShareRoot(coreUrl);
    if (!rootNote) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Share root not found." }, { status: 404 });
    }

    const searchUrl = `${coreUrl}/share/api/notes?ancestorNoteId=${encodeURIComponent(rootNote.noteId)}&search=${encodeURIComponent(query)}`;
    const res = await fetch(searchUrl);
    if (!res.ok) {
      return NextResponse.json({ error: "SERVICE_ERROR", message: "Search service unavailable" }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return handleRouteError(err);
  }
}
