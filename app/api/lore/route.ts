import { NextRequest, NextResponse } from "next/server";
import { searchNotes, createNote, createAttribute } from "@/lib/etapi-server";
import { getEtapiCreds } from "@/lib/get-creds";
import { handleRouteError, notConfigured } from "@/lib/route-error";

export async function GET(req: NextRequest) {
  try {
    const creds = await getEtapiCreds();
    if (!creds.url || !creds.token) return notConfigured("AllCodex");
    const q = req.nextUrl.searchParams.get("q") ?? "#lore";
    const notes = await searchNotes(creds, q);
    return NextResponse.json(notes);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const creds = await getEtapiCreds();
    if (!creds.url || !creds.token) return notConfigured("AllCodex");
    const { loreType, ...noteParams } = await req.json();
    if (!noteParams.parentNoteId) noteParams.parentNoteId = "root";
    const result = await createNote(creds, noteParams);
    const noteId = result?.note?.noteId ?? (result as any).noteId;
    if (noteId) {
      await createAttribute(creds, { noteId, type: "label", name: "lore", value: "" });
      if (loreType) {
        await createAttribute(creds, { noteId, type: "label", name: "loreType", value: loreType });
      }
    }
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
