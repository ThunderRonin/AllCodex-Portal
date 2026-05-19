export type RouteErrorPayload = {
  error: string;
  message: string;
};

/**
 * Determines whether a value conforms to the RouteErrorPayload shape.
 *
 * @returns `true` if `value` has string `error` and `message` properties, `false` otherwise.
 */
export function isRouteErrorPayload(value: unknown): value is RouteErrorPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    "message" in value &&
    typeof (value as { error?: unknown }).error === "string" &&
    typeof (value as { message?: unknown }).message === "string"
  );
}

/**
 * Read a Response body and return parsed JSON, raw text, or null.
 *
 * @param response - The Response whose body will be read
 * @returns `null` if the body is empty; the parsed JSON value if parsing succeeds; otherwise the raw text string
 */
async function readJsonOrText(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/**
 * Fetches a resource, parses its body as JSON (if parseable) or text, and throws for non-OK responses.
 *
 * @param input - Request URL or RequestInfo passed to fetch
 * @param init - Optional RequestInit passed to fetch
 * @returns The response body parsed as JSON when possible, otherwise the raw text, typed as `T`
 * @throws `RouteErrorPayload` when the non-OK response body matches `{ error: string; message: string }`
 * @throws `Error` when the non-OK response body is an `Error` instance
 * @throws `Error` with a message derived from the response body string, `response.statusText`, or `HTTP <status>` for other non-OK responses
 */
export async function fetchJsonOrThrow<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const body = await readJsonOrText(response);

  if (!response.ok) {
    if (isRouteErrorPayload(body)) {
      throw body;
    }

    if (body instanceof Error) {
      throw body;
    }

    const message =
      typeof body === "string"
        ? body
        : response.statusText || `HTTP ${response.status}`;
    throw new Error(message);
  }

  return body as T;
}
