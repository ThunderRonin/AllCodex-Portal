/**
 * Server-only ETAPI client for AllCodex (Trilium).
 * Never import this in Client Components — used only in API routes and Server Components.
 *
 * Auth: HTTP Basic auth with the ETAPI token as the username and an empty password.
 * Credentials are passed explicitly — resolved from cookies or env by get-creds.ts.
 */

export interface EtapiCreds {
  url: string;
  token: string;
}

function makeAuthHeader(token: string) {
  return `Basic ${Buffer.from(`${token}:`).toString("base64")}`;
}

async function etapiFetch(creds: EtapiCreds, path: string, init: RequestInit = {}): Promise<Response> {
  const url = `${creds.url}/etapi${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: makeAuthHeader(creds.token),
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
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
export async function searchNotes(creds: EtapiCreds, query: string): Promise<EtapiNote[]> {
  const res = await etapiFetch(creds, `/notes?search=${encodeURIComponent(query)}&limit=200`);
  const data = await res.json();
  return data.results ?? [];
}

/** Get a single note by ID */
export async function getNote(creds: EtapiCreds, noteId: string): Promise<EtapiNote> {
  const res = await etapiFetch(creds, `/notes/${noteId}`);
  return res.json();
}

/** Get note HTML content */
export async function getNoteContent(creds: EtapiCreds, noteId: string): Promise<string> {
  const res = await etapiFetch(creds, `/notes/${noteId}/content`);
  return res.text();
}

/** Create a new note */
export async function createNote(creds: EtapiCreds, params: CreateNoteParams): Promise<EtapiNote & { branch: unknown }> {
  const res = await etapiFetch(creds, "/create-note", {
    method: "POST",
    body: JSON.stringify({ type: "text", ...params }),
  });
  return res.json();
}

/** Update note metadata (title) */
export async function patchNote(creds: EtapiCreds, noteId: string, patch: { title?: string }): Promise<EtapiNote> {
  const res = await etapiFetch(creds, `/notes/${noteId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return res.json();
}

/** Update note content */
export async function putNoteContent(creds: EtapiCreds, noteId: string, html: string): Promise<void> {
  await etapiFetch(creds, `/notes/${noteId}/content`, {
    method: "PUT",
    headers: { "Content-Type": "text/html" },
    body: html,
  });
}

/** Delete a note */
export async function deleteNote(creds: EtapiCreds, noteId: string): Promise<void> {
  await etapiFetch(creds, `/notes/${noteId}`, { method: "DELETE" });
}

/** Create an attribute (label or relation) on a note */
export async function createAttribute(creds: EtapiCreds, params: {
  noteId: string;
  type: "label" | "relation";
  name: string;
  value: string;
  isInheritable?: boolean;
}): Promise<EtapiAttribute> {
  const res = await etapiFetch(creds, "/attributes", {
    method: "POST",
    body: JSON.stringify(params),
  });
  return res.json();
}

/** Get app info */
export async function getAppInfo(creds: EtapiCreds): Promise<EtapiAppInfo> {
  const res = await etapiFetch(creds, "/app-info");
  return res.json();
}
