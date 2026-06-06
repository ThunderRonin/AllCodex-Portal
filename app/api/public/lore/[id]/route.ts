import { NextRequest, NextResponse } from "next/server";
import { getNote, getNoteContent } from "@/lib/etapi-server";
import { getPublicEtapiCreds } from "@/lib/get-creds";
import { isPublicLoreNote, publicLoreSummary } from "@/lib/public-lore";
import { handleRouteError, notConfigured } from "@/lib/route-error";
import { sanitizePlayerView } from "@/lib/sanitize";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const creds = await getPublicEtapiCreds();
    if (!creds.url || !creds.token) return notConfigured("AllCodex");

    const { id } = await params;
    const note = await getNote(creds, id);
    if (!isPublicLoreNote(note)) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Lore entry not found." }, { status: 404 });
    }

    const contentHtml = sanitizePlayerView(await getNoteContent(creds, id));
    return NextResponse.json({
      ...publicLoreSummary(note),
      contentHtml,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
