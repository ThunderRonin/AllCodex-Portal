/**
 * Server-only AllKnower API client.
 * Never import this in Client Components — used only in API routes.
 *
 * Auth: Bearer token (better-auth session token stored in env).
 */

const BASE_URL = process.env.ALLKNOWER_URL!;
const BEARER = process.env.ALLKNOWER_BEARER_TOKEN!;

const HEADERS = {
  Authorization: `Bearer ${BEARER}`,
  "Content-Type": "application/json",
};

async function akFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: { ...HEADERS, ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`AllKnower ${init.method ?? "GET"} ${path} → ${res.status}: ${body}`);
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

export async function runBrainDump(rawText: string): Promise<BrainDumpResult> {
  const res = await akFetch("/brain-dump", {
    method: "POST",
    body: JSON.stringify({ rawText }),
  });
  return res.json();
}

export async function getBrainDumpHistory(): Promise<BrainDumpHistoryEntry[]> {
  const res = await akFetch("/brain-dump/history");
  return res.json();
}

// ── RAG ───────────────────────────────────────────────────────────────────────

export async function queryRag(text: string, topK = 10): Promise<RagChunk[]> {
  const res = await akFetch("/rag/query", {
    method: "POST",
    body: JSON.stringify({ text, topK }),
  });
  const data = await res.json();
  return data.results ?? [];
}

export async function getRagStatus(): Promise<{ indexedNotes: number; lastIndexed: string | null; model: string | null }> {
  const res = await akFetch("/rag/status");
  return res.json();
}

export async function triggerReindex(noteId?: string): Promise<{ ok: boolean }> {
  if (noteId) {
    const res = await akFetch(`/rag/reindex/${noteId}`, { method: "POST" });
    return res.json();
  }
  const res = await akFetch("/rag/reindex", { method: "POST" });
  return res.json();
}

// ── Intelligence ──────────────────────────────────────────────────────────────

export async function checkConsistency(noteIds?: string[]): Promise<ConsistencyResult> {
  const res = await akFetch("/consistency/check", {
    method: "POST",
    body: JSON.stringify({ noteIds }),
  });
  return res.json();
}

export async function suggestRelationships(text: string): Promise<{ suggestions: RelationshipSuggestion[] }> {
  const res = await akFetch("/suggest/relationships", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
  return res.json();
}

export async function getGaps(): Promise<GapResult> {
  const res = await akFetch("/suggest/gaps");
  return res.json();
}

export async function getHealth(): Promise<{ status: string; allcodex: string; ollama: string }> {
  const res = await akFetch("/health");
  return res.json();
}
