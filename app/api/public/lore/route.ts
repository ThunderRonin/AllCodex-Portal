import { NextResponse } from "next/server";
import { searchNotes } from "@/lib/etapi-server";
import { getPublicEtapiCreds } from "@/lib/get-creds";
import { isPublicLoreNote, publicLoreSummary } from "@/lib/public-lore";
import { handleRouteError, notConfigured } from "@/lib/route-error";

export async function GET() {
  try {
    const creds = await getPublicEtapiCreds();
    if (!creds.url || !creds.token) return notConfigured("AllCodex");

    const notes = await searchNotes(creds, "#lore");
    return NextResponse.json({
      items: notes.filter(isPublicLoreNote).map(publicLoreSummary),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
