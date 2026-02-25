/**
 * Server-only AllKnower API client.
 * Never import this in Client Components — used only in API routes.
 *
 * Auth: Bearer token passed explicitly — resolved from cookies or env by get-creds.ts.
 */

import { ServiceError } from "./route-error";

export interface AkCreds {
  url: string;
  token: string;
}

async function akFetch(creds: AkCreds, path: string, init: RequestInit = {}): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${creds.url}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${creds.token}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new ServiceError("UNREACHABLE", 503, `AllKnower is unreachable at ${creds.url}`);
  }
  if (res.status === 401) {
    throw new ServiceError("UNAUTHORIZED", 401, "AllKnower credentials are invalid. Go to Settings to reconnect.");
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ServiceError("SERVICE_ERROR", 502, `AllKnower ${init.method ?? "GET"} ${path} → ${res.status}: ${body}`);
  }
  return res;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BrainDumpResult {
  notesCreated: number;
  notesUpdated: number;
  summary: string;
  entities: Array<{
    action: "created" | "updated";
    noteId: string;
    title: string;
    type: string;
  }>;
}

export interface BrainDumpHistoryEntry {
  id: string;
  rawText: string;
  notesCreated: number;
  notesUpdated: number;
  model: string;
  tokensUsed: number | null;
  createdAt: string;
}

export interface RagChunk {
  noteId: string;
  noteTitle: string;
  content: string;
  score: number;
}

export interface ConsistencyIssue {
  type: "contradiction" | "timeline" | "orphan" | "naming";
  severity: "high" | "medium" | "low";
  description: string;
  affectedNoteIds: string[];
}

export interface ConsistencyResult {
  issues: ConsistencyIssue[];
  summary: string;
}

export interface RelationshipSuggestion {
  targetNoteId: string;
  targetTitle: string;
  relationshipType: string;
  description: string;
}

export interface GapArea {
  area: string;
  severity: "high" | "medium" | "low";
  description: string;
  suggestion: string;
}

export interface GapResult {
  gaps: GapArea[];
  summary: string;
}

// ── Brain Dump ────────────────────────────────────────────────────────────────

export async function runBrainDump(creds: AkCreds, rawText: string): Promise<BrainDumpResult> {
  const res = await akFetch(creds, "/brain-dump", {
    method: "POST",
    body: JSON.stringify({ rawText }),
  });
  return res.json();
}

export async function getBrainDumpHistory(creds: AkCreds): Promise<BrainDumpHistoryEntry[]> {
  const res = await akFetch(creds, "/brain-dump/history");
  return res.json();
}

// ── RAG ───────────────────────────────────────────────────────────────────────

export async function queryRag(creds: AkCreds, text: string, topK = 10): Promise<RagChunk[]> {
  const res = await akFetch(creds, "/rag/query", {
    method: "POST",
    body: JSON.stringify({ text, topK }),
  });
  const data = await res.json();
  return data.results ?? [];
}

export async function getRagStatus(creds: AkCreds): Promise<{ indexedNotes: number; lastIndexed: string | null; model: string | null }> {
  const res = await akFetch(creds, "/rag/status");
  return res.json();
}

export async function triggerReindex(creds: AkCreds, noteId?: string): Promise<{ ok: boolean }> {
  if (noteId) {
    const res = await akFetch(creds, `/rag/reindex/${noteId}`, { method: "POST" });
    return res.json();
  }
  const res = await akFetch(creds, "/rag/reindex", { method: "POST" });
  return res.json();
}

// ── Intelligence ──────────────────────────────────────────────────────────────

export async function checkConsistency(creds: AkCreds, noteIds?: string[]): Promise<ConsistencyResult> {
  const res = await akFetch(creds, "/consistency/check", {
    method: "POST",
    body: JSON.stringify({ noteIds }),
  });
  return res.json();
}

export async function suggestRelationships(creds: AkCreds, text: string): Promise<{ suggestions: RelationshipSuggestion[] }> {
  const res = await akFetch(creds, "/suggest/relationships", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
  return res.json();
}

export async function getGaps(creds: AkCreds): Promise<GapResult> {
  const res = await akFetch(creds, "/suggest/gaps");
  return res.json();
}

export async function getHealth(creds: AkCreds): Promise<{ status: string; allcodex: string; ollama: string }> {
  const res = await akFetch(creds, "/health");
  return res.json();
}
