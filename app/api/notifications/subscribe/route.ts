import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { subscribeNotifications } from "@/lib/allknower-server";
import { getAkCreds } from "@/lib/get-creds";
import { handleRouteError, notConfigured } from "@/lib/route-error";

const SubscribeBodySchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function POST(req: NextRequest) {
  try {
    const creds = await getAkCreds();
    if (!creds.url || !creds.token) return notConfigured("AllKnower");
    const parsed = SubscribeBodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: parsed.error.issues },
        { status: 400 },
      );
    }
    const result = await subscribeNotifications(creds, parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
