import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAkCreds } from "@/lib/get-creds";
import { handleRouteError, notConfigured } from "@/lib/route-error";
import { getUserBudget, putUserBudget } from "@/lib/allknower-server";

const BudgetBodySchema = z.object({
  dailyBudgetUsd: z.number().positive().nullable().optional(),
  monthlyBudgetUsd: z.number().positive().nullable().optional(),
  alertEmail: z.string().email().nullable().optional(),
});

export async function GET() {
  try {
    const creds = await getAkCreds();
    if (!creds.url || !creds.token) return notConfigured("AllKnower");
    const result = await getUserBudget(creds);
    return NextResponse.json(result);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const creds = await getAkCreds();
    if (!creds.url || !creds.token) return notConfigured("AllKnower");
    const parsed = BudgetBodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: parsed.error.issues },
        { status: 400 },
      );
    }
    await putUserBudget(creds, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
