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

/**
 * Handle POST requests that initiate and proxy an article copilot server-sent-events (SSE) stream.
 *
 * Parses the request body for chat messages and an optional sessionId, validates required credentials,
 * loads article-specific copilot context using the route `id` parameter and the latest user message,
 * and proxies an SSE stream to the client with the assembled payload.
 *
 * @param req - Incoming Next.js request containing a JSON body matching `ChatBodySchema`
 * @param params - Route parameters promise resolving to an object with `id` (the article/note identifier)
 * @returns A Response that streams server-sent events for the article copilot session, or an error/configuration response when credentials or processing fail
 */
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
