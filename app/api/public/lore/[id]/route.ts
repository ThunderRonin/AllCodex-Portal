import { NextRequest, NextResponse } from "next/server";
import { fetchCoreShareNote, normalizeCoreShareHtml } from "@/lib/core-share-server";
import { handleRouteError, notConfigured } from "@/lib/route-error";
import { sanitizeLoreHtml } from "@/lib/sanitize";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const coreUrl = process.env.ALLCODEX_URL ?? "";
    if (!coreUrl) return notConfigured("AllCodex");

    const { id } = await params;
    const note = await fetchCoreShareNote(coreUrl, id);
    if (!note) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Lore entry not found." }, { status: 404 });
    }

    return NextResponse.json({
      noteId: note.noteId,
      title: note.title,
      type: note.type,
      loreType: null,
      contentHtml: sanitizeLoreHtml(normalizeCoreShareHtml(coreUrl, note.content)),
      dateModified: note.utcDateModified ?? "",
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
