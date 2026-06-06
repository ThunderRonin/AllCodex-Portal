import { ServiceError } from "./route-error";

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

async function fetchCoreJson(baseUrl: string, path: string): Promise<unknown | null> {
  let response: Response;
  const url = `${normalizeBaseUrl(baseUrl)}${path}`;
  try {
    response = await fetch(url);
  } catch {
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

export async function getCoreShareNoteAccess(baseUrl: string, noteId: string): Promise<CoreShareNoteAccess> {
  const encodedNoteId = encodeURIComponent(noteId);
  let response: Response;
  try {
    response = await fetch(`${normalizeBaseUrl(baseUrl)}/share/api/notes/${encodedNoteId}`);
  } catch {
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
    .replace(/\b(src|href)=["']\/share\/api\//gi, `$1="${normalizedBase}/share/api/`)
    .replace(/\b(src|href)=["']share\/api\//gi, `$1="${normalizedBase}/share/api/`)
    .replace(/\bhref=["']\.\/([^"']+)["']/gi, (_match, shareId: string) => {
      return `href="/public/lore/${encodeURIComponent(shareId)}"`;
    });
}
