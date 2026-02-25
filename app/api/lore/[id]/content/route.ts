import { NextRequest, NextResponse } from "next/server";
import { getNoteContent, putNoteContent } from "@/lib/etapi-server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const html = await getNoteContent(id);
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const html = await req.text();
    await putNoteContent(id, html);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
