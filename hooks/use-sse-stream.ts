"use client";

import { useCallback, useRef } from "react";

export type SSEEvent = {
  event: string;
  data: unknown;
};

/**
 * Provides a React hook that produces an async generator for consuming an SSE-like POST stream and a cancellation callback.
 *
 * The returned `stream` posts `body` as JSON to a given `url`, reads the response body as a text stream, parses lines prefixed with `event: ` and `data: `, attempts to `JSON.parse` each `data:` payload (falls back to the raw string on parse failure), and yields `SSEEvent` objects for each `data:` line. The parser resets the current event name to `"message"` after emitting a payload or encountering a blank line. The returned `cancel` aborts any in-progress request and clears the internal controller.
 *
 * @returns An object with:
 *  - `stream`: an async generator function `(url: string, body: unknown) => AsyncGenerator<SSEEvent>` that consumes the server stream and yields `SSEEvent` values.
 *  - `cancel`: a function `() => void` that aborts the active fetch/read operation, if any.
 */
export function useSSEStream() {
  const abortRef = useRef<AbortController | null>(null);

  const stream = useCallback(async function* (
    url: string,
    body: unknown,
  ): AsyncGenerator<SSEEvent> {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok || !res.body) {
      throw new Error(`Stream failed: ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let currentEvent = "message";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          try {
            yield { event: currentEvent, data: JSON.parse(line.slice(6)) };
          } catch {
            yield { event: currentEvent, data: line.slice(6) };
          }
          currentEvent = "message";
        } else if (line === "") {
          currentEvent = "message";
        }
      }
    }
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  return { stream, cancel };
}
