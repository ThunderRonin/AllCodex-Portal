import { NextRequest, NextResponse } from "next/server";
import { getPublicEtapiCreds } from "@/lib/get-creds";
import { getCoreShareNoteAccess } from "@/lib/core-share-server";
import { handleRouteError, notConfigured } from "@/lib/route-error";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; filename: string }> }
) {
  try {
    const creds = await getPublicEtapiCreds();
    if (!creds.url) return notConfigured("AllCodex");

    const { id, filename } = await params;

    const access = await getCoreShareNoteAccess(creds.url, id);
    if (access === "missing") {
      return NextResponse.json({ error: "NOT_FOUND", message: "Image not found." }, { status: 404 });
    }
    if (access === "requiresAuth") {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Authentication required." }, { status: 401 });
    }

    const url = `${creds.url}/share/api/images/${encodeURIComponent(id)}/${encodeURIComponent(filename)}`;

    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: "NOT_FOUND", message: "Image not found." }, { status: 404 });
      }
      return NextResponse.json({ error: "SERVICE_ERROR", message: `Upstream error: ${response.status}` }, { status: 502 });
    }

    const contentType = response.headers.get("content-type") || "image/png";

    return new NextResponse(response.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
