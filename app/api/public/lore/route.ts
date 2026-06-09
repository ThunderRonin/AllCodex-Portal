import { NextResponse } from "next/server";
import { fetchCoreShareRoot, normalizeCoreShareHtml } from "@/lib/core-share-server";
import { handleRouteError, notConfigured } from "@/lib/route-error";
import { sanitizeLoreHtml } from "@/lib/sanitize";

export async function GET() {
  try {
    const coreUrl = process.env.ALLCODEX_URL ?? "";
    if (!coreUrl) return notConfigured("AllCodex");

    const note = await fetchCoreShareRoot(coreUrl);
    if (!note) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Published lore is not available." }, { status: 404 });
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
