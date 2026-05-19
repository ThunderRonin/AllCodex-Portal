import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getEtapiCreds } from "@/lib/get-creds";
import { applyArticleCopilotProposal } from "@/lib/article-copilot";
import { CopilotProposalSchema } from "@/lib/allknower-schemas";
import { handleRouteError, notConfigured } from "@/lib/route-error";

const ApplyBodySchema = z.object({
  proposal: CopilotProposalSchema,
  approvedTargetIds: z.array(z.string()),
});

/**
 * Apply a Copilot proposal to the lore article identified by the route `id`.
 *
 * Validates ETAPI credentials and the request body, then invokes the application
 * of the provided `proposal` with the supplied `approvedTargetIds`. Responds
 * with a JSON object that reflects the result of that operation.
 *
 * @param params - A promise resolving to an object with `id` (the route article identifier)
 * @returns A JSON response containing an `applied` field with the result of applying the proposal
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const creds = await getEtapiCreds();
    if (!creds.url || !creds.token) return notConfigured("AllCodex");

    const { id } = await params;
    const body = ApplyBodySchema.parse(await req.json());
    const applied = await applyArticleCopilotProposal(
      creds,
      id,
      body.proposal,
      body.approvedTargetIds,
    );

    return NextResponse.json({ applied });
  } catch (error) {
    return handleRouteError(error);
  }
}
