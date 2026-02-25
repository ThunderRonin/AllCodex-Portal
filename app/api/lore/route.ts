import { NextRequest, NextResponse } from "next/server";
import { searchNotes, createNote } from "@/lib/etapi-server";

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q") ?? "#lore";
    const notes = await searchNotes(q);
    return NextResponse.json(notes);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const note = await createNote(body);
    return NextResponse.json(note, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
