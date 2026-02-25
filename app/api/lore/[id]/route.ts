import { NextRequest, NextResponse } from "next/server";
import { getNote, patchNote, deleteNote } from "@/lib/etapi-server";
import { getEtapiCreds } from "@/lib/get-creds";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const creds = await getEtapiCreds();
    const { id } = await params;
    const note = await getNote(creds, id);
    return NextResponse.json(note);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const creds = await getEtapiCreds();
    const { id } = await params;
    const body = await req.json();
    const note = await patchNote(creds, id, body);
    return NextResponse.json(note);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const creds = await getEtapiCreds();
    const { id } = await params;
    await deleteNote(creds, id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
