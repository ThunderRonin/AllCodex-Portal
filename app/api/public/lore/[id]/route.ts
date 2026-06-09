import { NextRequest, NextResponse } from "next/server";
import { getPublicEtapiCreds } from "@/lib/get-creds";
import { getCoreShareNoteAccess, normalizeCoreShareHtml } from "@/lib/core-share-server";
import { getNote, getNoteContent, getThemeSongUrl, getPortraitImageNoteId, searchNotes } from "@/lib/etapi-server";
import { handleRouteError, notConfigured } from "@/lib/route-error";
import { sanitizeLoreHtml } from "@/lib/sanitize";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const creds = await getPublicEtapiCreds();
    if (!creds.url || !creds.token) {
      return notConfigured("AllCodex");
    }

    const { id } = await params;

    // Resolve custom share alias to actual noteId if necessary
    let resolvedId = id;
    const aliasNotes = await searchNotes(creds, `#shareAlias="${id}"`);
    if (aliasNotes.length > 0) {
      resolvedId = aliasNotes[0].noteId;
    }

    // Call getCoreShareNoteAccess(creds.url, resolvedId) to verify public readability.
    const access = await getCoreShareNoteAccess(creds.url, resolvedId);
    if (access === "missing") {
      return NextResponse.json({ error: "NOT_FOUND", message: "Lore entry not found." }, { status: 404 });
    }
    if (access === "requiresAuth") {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Authentication required." }, { status: 401 });
    }

    // Fetch the note from Core using getNote(creds, resolvedId)
    const note = await getNote(creds, resolvedId);
    if (!note) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Lore entry not found." }, { status: 404 });
    }

    // Security check: If the note has a label with name "draft" or "gmOnly", return a 404 response (hidden from public).
    const isHidden = (note.attributes ?? []).some(
      (attr) => attr.type === "label" && (attr.name === "draft" || attr.name === "gmOnly")
    );
    if (isHidden) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Lore entry not found." }, { status: 404 });
    }

    // Fetch note content
    const noteContent = await getNoteContent(creds, resolvedId);

    // Resolve theme song URL using getThemeSongUrl(note)
    const themeSongUrl = getThemeSongUrl(note);

    // Resolve portrait image note ID using getPortraitImageNoteId(note)
    const portraitImageNoteId = getPortraitImageNoteId(note);

    // Filter note.attributes to return only display-worthy attributes:
    // Remove system labels: "draft", "gmOnly", "shareAlias", "shareCredentials", "shareRoot", "lore", "themeSongUrl", "portrait", "customSectionOrder", "statblock"
    const systemLabels = new Set([
      "draft",
      "gmOnly",
      "shareAlias",
      "shareCredentials",
      "shareRoot",
      "lore",
      "themeSongUrl",
      "portrait",
      "customSectionOrder",
      "statblock"
    ]);

    const filteredAttributes = (note.attributes ?? []).filter(
      (attr) => !(attr.type === "label" && systemLabels.has(attr.name))
    );

    // Resolve loreType attribute value
    const loreType = (note.attributes ?? []).find((attr) => attr.name === "loreType")?.value ?? null;

    return NextResponse.json({
      noteId: note.noteId,
      title: note.title,
      loreType,
      contentHtml: sanitizeLoreHtml(normalizeCoreShareHtml(creds.url, noteContent)),
      attributes: filteredAttributes,
      portraitImageNoteId,
      themeSongUrl,
      dateModified: note.utcDateModified || note.dateModified || "",
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
