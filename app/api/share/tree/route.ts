import { NextResponse } from "next/server";
import { getEtapiCreds } from "@/lib/get-creds";
import { handleRouteError, notConfigured } from "@/lib/route-error";
import { searchNotes } from "@/lib/etapi-server";
import { getCoreShareNoteAccess } from "@/lib/core-share-server";

/**
 * GET /api/share/tree
 * Returns all #lore notes with their share-relevant attributes:
 * draft, gmOnly, shareAlias, shareCredentials presence.
 * Used by the Shared Content Browser.
 */
export async function GET() {
  try {
    const creds = await getEtapiCreds();
    if (!creds.url || !creds.token) return notConfigured("AllCodex");

    const notes = await searchNotes(creds, "#lore");

    const items = await Promise.all(notes.map(async (n) => {
      const isDraft = n.attributes.some((a) => a.name === "draft" && a.type === "label");
      const isGmOnly = n.attributes.some((a) => a.name === "gmOnly" && a.type === "label");
      const shareAlias = n.attributes.find((a) => a.name === "shareAlias")?.value ?? null;
      const isProtected = n.attributes.some((a) => a.name === "shareCredentials" && a.type === "label");
      const shareAccess = await getCoreShareNoteAccess(creds.url, n.noteId);
      const isInShareTree = shareAccess !== "missing";
      const isPublished = isInShareTree && !isDraft && !isGmOnly && !isProtected;

      return {
        noteId: n.noteId,
        title: n.title,
        loreType: n.attributes.find((a) => a.name === "loreType")?.value ?? null,
        isDraft,
        isGmOnly,
        shareAlias,
        isProtected,
        isInShareTree,
        isPublished,
        shareUrl: isInShareTree ? `${creds.url}/share/${shareAlias ?? n.noteId}` : null,
        dateModified: n.dateModified,
      };
    }));

    return NextResponse.json(items);
  } catch (err) {
    return handleRouteError(err);
  }
}
