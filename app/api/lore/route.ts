import { NextRequest, NextResponse } from "next/server";
import { searchNotes, createNote } from "@/lib/etapi-server";
import { getEtapiCreds } from "@/lib/get-creds";

export async function GET(req: NextRequest) {
  try {
    const creds = await getEtapiCreds();
    const q = req.nextUrl.searchParams.get("q") ?? "#lore";
    const notes = await searchNotes(creds, q);
    return NextResponse.json(notes);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const creds = await getEtapiCreds();
    const body = await req.json();
    const note = await createNote(creds, body);
    return NextResponse.json(note, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
