import type { AkCreds } from "./get-creds";

/**
 * Proxies a POST request to an upstream AllKnower SSE endpoint and returns the upstream response as an `text/event-stream`.
 *
 * When `creds.url` or `creds.token` is missing, or the upstream is unreachable, the function returns an SSE-formatted error response with status `503`. If the upstream responds with a non-OK status or no body, it returns an SSE-formatted error response with status `502` (including upstream text when available). On success, the returned `Response` streams the upstream body and includes SSE-appropriate headers.
 *
 * @param creds - AllKnower credentials object with `url` (base URL) and `token` (Bearer token)
 * @param path - Path to append to `creds.url` for the POST request
 * @param body - JSON-serializable payload to send in the POST request body
 * @param timeoutMs - Request timeout in milliseconds (default: 300000)
 * @returns A `Response` whose body is `text/event-stream`: either a streaming proxy of the upstream SSE body or an SSE-formatted error event with status `503` or `502`
 */
export async function proxySSE(
  creds: AkCreds,
  path: string,
  body: unknown,
  timeoutMs = 300_000,
): Promise<Response> {
  if (!creds.url || !creds.token) {
    return new Response(
      `event: error\ndata: ${JSON.stringify({ error: "AllKnower not configured" })}\n\n`,
      { status: 503, headers: { "Content-Type": "text/event-stream" } },
    );
  }

  let res: Response;
  try {
    res = await fetch(`${creds.url}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${creds.token}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return new Response(
      `event: error\ndata: ${JSON.stringify({ error: "AllKnower is unreachable" })}\n\n`,
      { status: 503, headers: { "Content-Type": "text/event-stream" } },
    );
  }

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "Unknown error");
    return new Response(
      `event: error\ndata: ${JSON.stringify({ error: text })}\n\n`,
      { status: 502, headers: { "Content-Type": "text/event-stream" } },
    );
  }

  const upstream = res.body;
  const safe = new ReadableStream({
    async start(controller) {
      const reader = upstream.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
      } catch {
        // Upstream closed (AllKnower finished) — not an error for the client
      } finally {
        controller.close();
      }
    },
  });

  return new Response(safe, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
