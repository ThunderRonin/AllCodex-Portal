import { NextRequest, NextResponse } from "next/server";
import { getEtapiCreds } from "@/lib/get-creds";
import { createNote, createAttribute } from "@/lib/etapi-server";
import { handleRouteError, notConfigured } from "@/lib/route-error";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        const creds = await getEtapiCreds();
        if (!creds.url || !creds.token) return notConfigured("AllCodex");

        const formData = await req.formData();
        const file = formData.get("image") as File | null;
        const width = formData.get("width") as string | null;
        const height = formData.get("height") as string | null;

        if (!file || !file.type.startsWith("image/")) {
            return NextResponse.json(
                { error: "INVALID_REQUEST", message: "Image file required" },
                { status: 400 },
            );
        }

        // Step 1: Create empty image child note
        // createNote() defaults content to "<p></p>" for empty strings;
        // the binary PUT below immediately overwrites it.
        const imageNote = await createNote(creds, {
            parentNoteId: id,
            title: "Map Background",
            type: "image",
            mime: file.type,
        });

        const imageNoteId = imageNote.note.noteId;

        // Step 2: PUT binary content directly (octet-stream, not text/plain)
        const imageBuffer = Buffer.from(await file.arrayBuffer());
        const putRes = await fetch(`${creds.url}/etapi/notes/${imageNoteId}/content`, {
            method: "PUT",
            headers: {
                Authorization: creds.token,
                "Content-Type": "application/octet-stream",
            },
            body: imageBuffer,
        });

        if (!putRes.ok) {
            throw new Error(`Failed to upload image content: ${await putRes.text()}`);
        }

        // Create mapImage relation on parent
        await createAttribute(creds, {
            noteId: id,
            type: "relation",
            name: "mapImage",
            value: imageNoteId,
        });

        // Store natural dimensions as labels
        if (width) {
            await createAttribute(creds, {
                noteId: id,
                type: "label",
                name: "mapWidth",
                value: width,
            });
        }
        if (height) {
            await createAttribute(creds, {
                noteId: id,
                type: "label",
                name: "mapHeight",
                value: height,
            });
        }

        return NextResponse.json({
            imageNoteId,
            width: width ? parseInt(width, 10) : null,
            height: height ? parseInt(height, 10) : null,
        });
    } catch (err) {
        return handleRouteError(err);
    }
}
