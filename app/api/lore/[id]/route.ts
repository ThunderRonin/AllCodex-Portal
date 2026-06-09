import { NextRequest, NextResponse } from "next/server";
import { getNote, getPortraitImageNoteId, getThemeSongUrl, patchNote, deleteNote, resolveNoteRelations } from "@/lib/etapi-server";
import { getEtapiCreds } from "@/lib/get-creds";
import { handleRouteError, notConfigured } from "@/lib/route-error";
import { getCoreShareNoteAccess } from "@/lib/core-share-server";

/**
 * Retrieve a lore note by id and return its data augmented with resolved relations, portrait image note id, and theme song URL.
 *
 * @param _req - Incoming request (unused).
 * @param params - An object whose `id` promise resolves to the note's id.
 * @returns The note's properties merged with `resolvedRelations`, `portraitImageNoteId`, and `themeSongUrl`.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const creds = await getEtapiCreds();
    if (!creds.url || !creds.token) return notConfigured("AllCodex");
    const { id } = await params;
    const note = await getNote(creds, id);
    const [resolvedRelations, portraitImageNoteId, themeSongUrl, shareAccess] = await Promise.all([
      resolveNoteRelations(creds, note),
      Promise.resolve(getPortraitImageNoteId(note)),
      Promise.resolve(getThemeSongUrl(note)),
      getCoreShareNoteAccess(creds.url, id).catch(() => "missing" as const),
    ]);
    const isInShareTree = shareAccess !== "missing";
    return NextResponse.json({
      ...note,
      resolvedRelations,
      portraitImageNoteId,
      themeSongUrl,
      isInShareTree,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const creds = await getEtapiCreds();
    if (!creds.url || !creds.token) return notConfigured("AllCodex");
    const { id } = await params;
    const body = await req.json();
    const note = await patchNote(creds, id, body);
    return NextResponse.json(note);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const creds = await getEtapiCreds();
    if (!creds.url || !creds.token) return notConfigured("AllCodex");
    const { id } = await params;
    await deleteNote(creds, id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
