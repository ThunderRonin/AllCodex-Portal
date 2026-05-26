import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAkCreds } from "@/lib/get-creds";
import { handleRouteError, notConfigured } from "@/lib/route-error";
import { submitBrainDumpBatch } from "@/lib/allknower-server";

const BrainDumpBatchBodySchema = z.object({
  items: z
    .array(
      z.object({
        rawText: z.string().min(10),
        parentNoteId: z.string().optional(),
        mode: z.enum(["auto", "review"]).optional(),
      }),
    )
    .min(1),
});

export async function POST(req: NextRequest) {
  try {
    const creds = await getAkCreds();
    if (!creds.url || !creds.token) return notConfigured("AllKnower");
    const parsed = BrainDumpBatchBodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: parsed.error.issues },
        { status: 400 },
      );
    }
    const result = await submitBrainDumpBatch(creds, parsed.data.items);
    return NextResponse.json(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
