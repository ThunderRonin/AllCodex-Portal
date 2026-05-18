import { NextRequest } from "next/server";
import { getAkCreds, getEtapiCreds } from "@/lib/get-creds";
import { handleRouteError, notConfigured } from "@/lib/route-error";
import { loadArticleCopilotContext, trimCopilotTranscript } from "@/lib/article-copilot";
import { proxySSE } from "@/lib/sse-proxy";
import { ChatMessageSchema } from "@/lib/allknower-schemas";
import { z } from "zod";

const ChatBodySchema = z.object({
  messages: z.array(ChatMessageSchema),
  sessionId: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const [etapiCreds, akCreds] = await Promise.all([getEtapiCreds(), getAkCreds()]);
    if (!etapiCreds.url || !etapiCreds.token) return notConfigured("AllCodex");
    if (!akCreds.url || !akCreds.token) return notConfigured("AllKnower");

    const { id } = await params;
    const body = ChatBodySchema.parse(await req.json());
    const transcript = trimCopilotTranscript(body.messages);
    const latestUserMessage = [...transcript].reverse().find((message) => message.role === "user")?.content ?? "";
    const context = await loadArticleCopilotContext(etapiCreds, akCreds, id, latestUserMessage);

    return proxySSE(akCreds, "/copilot/article/stream", {
      noteId: id,
      sessionId: body.sessionId,
      transcript,
      ...context,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
