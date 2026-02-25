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