import { NextRequest, NextResponse } from "next/server";
import { getNote } from "@/lib/etapi-server";
import { getEtapiCreds } from "@/lib/get-creds";
import { getMapDimensions, getMapImageNoteId, notesToPins } from "@/lib/map-utils";
import { handleRouteError, notConfigured } from "@/lib/route-error";

/**
 * Handle a GET request to produce map data for a lore note.
 *
 * Determines an optional map image URL (from a map-image relation or the first image child), extracts map
 * dimensions from the note (defaults to 1000×1000 when absent), and converts child notes with geolocation
 * information into `pins`.
 *
 * @param _req - The incoming NextRequest (unused).
 * @param params - A promise resolving to route params; `params.id` is the target note ID.
 * @returns An object with `imageUrl` (string | null), `width` (number), `height` (number), and `pins` (array of pin objects).
 */
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const creds = await getEtapiCreds();
        if (!creds.url || !creds.token) return notConfigured("AllCodex");

        const { id } = await params;
        const note = await getNote(creds, id);

        // Get map image (relation or first image child)
        const imageNoteId = getMapImageNoteId(note);
        let imageUrl: string | null = null;
        if (imageNoteId) {
            imageUrl = `/api/lore/${imageNoteId}/content`;
        } else {
            // Fallback: find first image-type child note
            const children = await Promise.all(
                note.childNoteIds.slice(0, 20).map((cid) =>
                    getNote(creds, cid).catch(() => null),
                ),
            );
            const imageChild = children.find(
                (c) => c && (c.type === "image" || c.mime?.startsWith("image/")),
            );
            if (imageChild) {
                imageUrl = `/api/lore/${imageChild.noteId}/content`;
            }
        }

        // Get dimensions from note attributes (fallback to 1000x1000)
        const dimensions = getMapDimensions(note);

        // Get pins from child notes with #geolocation label
        const locationChildren = await Promise.all(
            note.childNoteIds.map((cid) => getNote(creds, cid).catch(() => null)),
        );
        const validChildren = locationChildren.filter(
            (c): c is NonNullable<typeof c> => c !== null,
        );
        const pins = notesToPins(validChildren);

        return NextResponse.json({
            imageUrl,
            width: dimensions?.width ?? 1000,
            height: dimensions?.height ?? 1000,
            pins,
        });
    } catch (err) {
        return handleRouteError(err);
    }
}
