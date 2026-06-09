import { NextRequest, NextResponse } from "next/server";
import { getEtapiCreds } from "@/lib/get-creds";
import { handleRouteError, notConfigured } from "@/lib/route-error";
import { getNoteContent } from "@/lib/etapi-server";
import { normalizeLoreHtmlForPortal, sanitizePlayerView, sanitizeLoreHtml } from "@/lib/sanitize";
import { fetchCoreShareNote, normalizeCoreShareHtml } from "@/lib/core-share-server";

/**
 * GET /api/lore/[id]/preview?mode=player|gm
 *
 * mode=gm (default): Returns the note content sanitized for GM display (all content).
 * mode=player: Returns content with .gm-only elements stripped, simulating player view.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const creds = await getEtapiCreds();
    if (!creds.url || !creds.token) return notConfigured("AllCodex");

    const { id } = await params;
    const mode = req.nextUrl.searchParams.get("mode") ?? "gm";

    if (mode === "player") {
      const note = await fetchCoreShareNote(creds.url, id);
      const processed = note
        ? sanitizePlayerView(normalizeCoreShareHtml(creds.url, note.content))
        : "";

      return new NextResponse(processed, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const rawContent = await getNoteContent(creds, id);
    const processed = sanitizeLoreHtml(normalizeLoreHtmlForPortal(rawContent));

    return new NextResponse(processed, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
