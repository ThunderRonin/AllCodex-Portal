import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { unsubscribeNotifications } from "@/lib/allknower-server";
import { getAkCreds } from "@/lib/get-creds";
import { handleRouteError, notConfigured } from "@/lib/route-error";

const UnsubscribeBodySchema = z.object({
  endpoint: z.string().url(),
});

export async function DELETE(req: NextRequest) {
  try {
    const creds = await getAkCreds();
    if (!creds.url || !creds.token) return notConfigured("AllKnower");
    const parsed = UnsubscribeBodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: parsed.error.issues },
        { status: 400 },
      );
    }
    const result = await unsubscribeNotifications(creds, parsed.data.endpoint);
    return NextResponse.json(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
