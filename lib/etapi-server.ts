/**
 * Server-only ETAPI client for AllCodex (Trilium).
 * Never import this in Client Components — used only in API routes and Server Components.
 *
 * Auth: HTTP Basic auth with the ETAPI token as the username and an empty password.
 */

const BASE_URL = process.env.ALLCODEX_URL!;
const TOKEN = process.env.ALLCODEX_ETAPI_TOKEN!;

const AUTH_HEADER = `Basic ${Buffer.from(`${TOKEN}:`).toString("base64")}`;

const HEADERS = {
  Authorization: AUTH_HEADER,
  "Content-Type": "application/json",
};

async function etapiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const url = `${BASE_URL}/etapi${path}`;
  const res = await fetch(url, {
    ...init,
    headers: { ...HEADERS, ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ETAPI ${init.method ?? "GET"} ${path} → ${res.status}: ${body}`);
  }
  return res;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EtapiAttribute {
  attributeId: string;
  noteId: string;
  type: "label" | "relation";
  name: string;
  value: string;
  isInheritable: boolean;
}

export interface EtapiNote {
  noteId: string;
  title: string;
  type: string;
  mime: string;
  isProtected: boolean;
  dateCreated: string;
  dateModified: string;
  utcDateCreated: string;
  utcDateModified: string;
  parentNoteIds: string[];
  childNoteIds: string[];
  attributes: EtapiAttribute[];
}

export interface CreateNoteParams {
  parentNoteId: string;
  title: string;
  type?: "text" | "code" | "file" | "image" | "search" | "book" | "noteMap" | "webView";
  mime?: string;
  content?: string;
  notePosition?: number;
  noteId?: string;
}

export interface EtapiAppInfo {
  appVersion: string;
  dbVersion: number;
  syncVersion: number;
  buildDate: string;
  buildRevision: string;
  dataDirectory: string;
  clipperProtocolVersion: string;
}

// ── API ───────────────────────────────────────────────────────────────────────

/** Search for notes using Trilium search syntax, e.g. "#template #lore" */
export async function searchNotes(query: string): Promise<EtapiNote[]> {
  const res = await etapiFetch(`/notes?search=${encodeURIComponent(query)}&limit=200`);
  const data = await res.json();
  return data.results ?? [];
}

/** Get a single note by ID */
export async function getNote(noteId: string): Promise<EtapiNote> {
  const res = await etapiFetch(`/notes/${noteId}`);
  return res.json();
}

/** Get note HTML content */
export async function getNoteContent(noteId: string): Promise<string> {
  const res = await etapiFetch(`/notes/${noteId}/content`);
  return res.text();
}

/** Create a new note */
export async function createNote(params: CreateNoteParams): Promise<EtapiNote & { branch: unknown }> {
  const res = await etapiFetch("/create-note", {
    method: "POST",
    body: JSON.stringify(params),
  });
  return res.json();
}