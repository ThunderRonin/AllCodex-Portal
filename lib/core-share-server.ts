import { ServiceError } from "./route-error";

const CORE_SHARE_FETCH_TIMEOUT_MS = 8_000;

export interface CoreShareNote {
  noteId: string;
  title: string;
  type: string;
  mime: string;
  content: string;
  header?: string;
  utcDateModified?: string;
}

export type CoreShareNoteAccess = "readable" | "requiresAuth" | "missing";

function normalizeBaseUrl(baseUrl: string): string {
  let end = baseUrl.length;
  while (end > 0 && baseUrl[end - 1] === "/") {
    end -= 1;
  }
  return baseUrl.slice(0, end);
}

function isAbortError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "name" in error &&
      (error as { name?: unknown }).name === "AbortError"
  );
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CORE_SHARE_FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } catch (error) {
    if (isAbortError(error)) {
      throw new ServiceError("UNREACHABLE", 503, `AllCodex did not respond before ${CORE_SHARE_FETCH_TIMEOUT_MS}ms at ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchCoreJson(baseUrl: string, path: string): Promise<unknown> {
  let response: Response;
  const url = `${normalizeBaseUrl(baseUrl)}${path}`;
  try {
    response = await fetchWithTimeout(url);
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new ServiceError("UNREACHABLE", 503, `AllCodex is unreachable at ${baseUrl}`);
  }

  if ([401, 403, 404].includes(response.status)) {
    return null;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new ServiceError("SERVICE_ERROR", 502, `Core share ${path} -> ${response.status}: ${body}`);
  }

  return response.json();
}

function toCoreShareNote(value: unknown): CoreShareNote | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (typeof data.noteId !== "string" || typeof data.title !== "string") return null;

  return {
    noteId: data.noteId,
    title: data.title,
    type: typeof data.type === "string" ? data.type : "text",
    mime: typeof data.mime === "string" ? data.mime : "text/html",
    content: typeof data.content === "string" ? data.content : "",
    header: typeof data.header === "string" ? data.header : undefined,
    utcDateModified: typeof data.utcDateModified === "string" ? data.utcDateModified : undefined,
  };
}

export async function fetchCoreShareRoot(baseUrl: string): Promise<CoreShareNote | null> {
  return toCoreShareNote(await fetchCoreJson(baseUrl, "/share/"));
}

export async function fetchCoreShareNote(baseUrl: string, shareId: string): Promise<CoreShareNote | null> {
  const encodedShareId = encodeURIComponent(shareId);
  return toCoreShareNote(await fetchCoreJson(baseUrl, `/share/${encodedShareId}`));
}

export interface CoreShareAttributePojo {
  attributeId: string;
  noteId: string;
  type: string;
  name: string;
  value: string;
}

export interface CoreShareNotePojo {
  noteId: string;
  title: string;
  type: string;
  mime: string;
  utcDateModified: string;
  attributes: CoreShareAttributePojo[];
}

export async function fetchCoreShareNotePojo(baseUrl: string, noteId: string): Promise<CoreShareNotePojo | null> {
  const encodedNoteId = encodeURIComponent(noteId);
  const data = await fetchCoreJson(baseUrl, `/share/api/notes/${encodedNoteId}`);
  if (!data) return null;
  return data as CoreShareNotePojo;
}

export async function getCoreShareNoteAccess(baseUrl: string, noteId: string): Promise<CoreShareNoteAccess> {
  const encodedNoteId = encodeURIComponent(noteId);
  let response: Response;
  try {
    response = await fetchWithTimeout(`${normalizeBaseUrl(baseUrl)}/share/api/notes/${encodedNoteId}`);
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new ServiceError("UNREACHABLE", 503, `AllCodex is unreachable at ${baseUrl}`);
  }

  if (response.ok) return "readable";
  if (response.status === 401) return "requiresAuth";
  if ([403, 404].includes(response.status)) return "missing";

  const body = await response.text().catch(() => "");
  throw new ServiceError("SERVICE_ERROR", 502, `Core share /share/api/notes/${encodedNoteId} -> ${response.status}: ${body}`);
}

export function normalizeCoreShareHtml(baseUrl: string, html: string): string {
  const normalizedBase = normalizeBaseUrl(baseUrl);
  return html
    .replace(/\b(src|href)=["']\/?share\/api\/images\//gi, `$1="/api/public/images/`)
    .replace(/\b(src|href)=["']\/share\/api\//gi, `$1="${normalizedBase}/share/api/`)
    .replace(/\b(src|href)=["']share\/api\//gi, `$1="${normalizedBase}/share/api/`)
    .replace(/\bhref=["']\.\/([^"']+)["']/gi, (_match, shareId: string) => {
      return `href="/public/lore/${encodeURIComponent(shareId)}"`;
    });
}
