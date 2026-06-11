import { NextRequest, NextResponse } from "next/server";
import { getEtapiCreds } from "@/lib/get-creds";
import { handleRouteError, notConfigured } from "@/lib/route-error";
import {
  searchNotes,
  createAttribute,
  deleteAttribute,
  getNote,
  getBranch,
  deleteBranch,
  createBranch,
} from "@/lib/etapi-server";

/**
 * GET /api/share
 * Returns the share root configuration: the note that carries #shareRoot.
 */
export async function GET() {
  try {
    const creds = await getEtapiCreds();
    if (!creds.url || !creds.token) return notConfigured("AllCodex");

    const notes = await searchNotes(creds, "#shareRoot");
    if (notes.length === 0) {
      return NextResponse.json({ configured: false, noteId: null, title: null, alias: null, url: null });
    }

    const note = notes[0];
    const alias = note.attributes.find((a) => a.name === "shareAlias")?.value ?? null;
    const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || "/";
    return NextResponse.json({
      configured: true,
      noteId: note.noteId,
      title: note.title,
      alias,
      url: portalUrl,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

/**
 * PUT /api/share
 * Body: { noteId: string }
 * Removes #shareRoot from any current holder, then sets it on the given note.
 */
export async function PUT(req: NextRequest) {
  try {
    const creds = await getEtapiCreds();
    if (!creds.url || !creds.token) return notConfigured("AllCodex");

    const body = await req.json();
    const { noteId } = body as { noteId?: string };
    if (!noteId) {
      return NextResponse.json({ error: "noteId is required" }, { status: 400 });
    }

    // Fetch the note with ID _share
    const shareNote = await getNote(creds, "_share");
    let branchExists = false;
    if (shareNote.childBranchIds && shareNote.childBranchIds.length > 0) {
      for (const branchId of shareNote.childBranchIds) {
        const branch = await getBranch(creds, branchId);
        if (branch) {
          if (branch.noteId === noteId) {
            branchExists = true;
          } else {
            await deleteBranch(creds, branchId);
          }
        }
      }
    }

    if (!branchExists) {
      await createBranch(creds, { noteId, parentNoteId: "_share" });
    }

    // Remove existing #shareRoot labels
    const existing = await searchNotes(creds, "#shareRoot");
    await Promise.all(
      existing.flatMap((n) =>
        n.attributes
          .filter((a) => a.name === "shareRoot" && a.type === "label")
          .map((a) => deleteAttribute(creds, a.attributeId))
      )
    );

    // Set #shareRoot on the requested note
    const attr = await createAttribute(creds, {
      noteId,
      type: "label",
      name: "shareRoot",
      value: "",
    });

    return NextResponse.json({ noteId, attributeId: attr.attributeId });
  } catch (err) {
    return handleRouteError(err);
  }
}

