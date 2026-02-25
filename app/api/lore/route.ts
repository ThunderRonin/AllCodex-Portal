import { NextRequest, NextResponse } from "next/server";
import { searchNotes, createNote } from "@/lib/etapi-server";
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
    const body = await req.json();
    const note = await createNote(creds, body);
    return NextResponse.json(note, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
