/**
 * Server-only AllKnower API client.
 * Never import this in Client Components — used only in API routes.
 *
 * Auth: Bearer token passed explicitly — resolved from cookies or env by get-creds.ts.
 */

import { cookies } from "next/headers";
import { ServiceError } from "./route-error";
import {
  CopilotChatResponseSchema,
  type CopilotChatResponse,
  type CopilotRequest,
  ApplyRelationshipsResultSchema,
  BrainDumpAnyResultSchema,
  BrainDumpResultSchema,
  ConsistencyResultSchema,
  GapResultSchema,
  GraphResponseSchema,
  RelationshipsResultSchema,
  RelationHistoryResponseSchema,
  type ApplyRelationshipsResult,
  type ConsistencyResult,
  type GapResult,
  type GraphResponse,
  type RelationshipsResult,
  type RelationHistoryEntry,
  MetricsLLMResultSchema,
  type MetricsLLMResult,
  type PushSubscriptionPayload,
  BrainDumpBatchSchema,
  BrainDumpBatchSubmitResultSchema,
  BrainDumpDiffsResponseSchema,
  type BrainDumpBatch,
  type BrainDumpBatchSubmitResult,
  type BrainDumpDiffsResponse,
  UsageSummarySchema,
  UserBudgetSchema,
  UsageAlertStatusSchema,
  type UsageSummary,
  type UserBudget,
  type UsageAlertStatus,
} from "./allknower-schemas";

export interface AkCreds {
  url: string;
  token: string;
}

/**
 * Build request headers configured for JSON payloads and optional Bearer authentication.
 *
 * @param initHeaders - Existing headers to start from; may be `undefined`.
 * @param token - Optional bearer token to set as `Authorization: Bearer <token>`.
 * @returns A `HeadersInit` containing the merged headers, guaranteeing `Content-Type: application/json` if absent and including an `Authorization` header when `token` is provided.
 */
function buildJsonHeaders(initHeaders: HeadersInit | undefined, token?: string): HeadersInit {
  const headers = new Headers(initHeaders);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return headers;
}

/**
 * Perform an authenticated HTTP request to the AllKnower service and map common failures to ServiceError.
 *
 * @param creds - AllKnower credentials containing the base `url` and bearer `token` used for the request
 * @param path - Request path appended to `creds.url` (should begin with `/` when appropriate)
 * @param init - Optional RequestInit merged into the fetch call; headers are augmented with JSON content-type and the Authorization bearer token
 * @returns The successful `Response` returned by the AllKnower service
 * @throws ServiceError with code `UNREACHABLE` (503) when the host cannot be reached
 * @throws ServiceError with code `UNAUTHORIZED` (401) when the session is invalid; this also attempts to clear session cookies
 * @throws ServiceError with code `SERVICE_ERROR` (502) for non-OK HTTP responses, including status and response body
 */
async function akFetch(creds: AkCreds, path: string, init: RequestInit = {}): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${creds.url}${path}`, {
      ...init,
      headers: buildJsonHeaders(init.headers, creds.token),
    });
  } catch {
    throw new ServiceError("UNREACHABLE", 503, `AllKnower is unreachable at ${creds.url}`);
  }
  if (res.status === 401) {
    try {
      const jar = await cookies();
      jar.delete("allknower_token");
      jar.delete("allknower_url");
    } catch {}
    throw new ServiceError("UNAUTHORIZED", 401, "AllKnower session expired. Please sign in again.");
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ServiceError("SERVICE_ERROR", 502, `AllKnower ${init.method ?? "GET"} ${path} → ${res.status}: ${body}`);
  }
  return res;
}

/**
 * Perform an unauthenticated HTTP request to the AllKnower service with JSON headers.
 *
 * @param url - The AllKnower base URL to send the request to
 * @param path - The request path to append to `url`
 * @param init - Additional fetch options; headers will be merged with JSON headers
 * @returns The HTTP Response from the request
 * @throws ServiceError with code `"UNREACHABLE"` and status `503` if the AllKnower service cannot be reached
 */
async function akPublicFetch(url: string, path: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(`${url}${path}`, {
      ...init,
      headers: buildJsonHeaders(init.headers),
    });
  } catch {
    throw new ServiceError("UNREACHABLE", 503, `AllKnower is unreachable at ${url}`);
  }
}

/**
 * Sign in to an AllKnower instance with email credentials and return the session token and user.
 *
 * @param url - Base AllKnower URL; used as the request origin and to construct the auth endpoint
 * @param email - Account email address
 * @param password - Account password
 * @returns An object with `token` containing the session token and `user` containing the authenticated user object or `null`
 * @throws ServiceError("UNAUTHORIZED", 401, ...) if the credentials are rejected by the server
 * @throws ServiceError("SERVICE_ERROR", 502, ...) if the response does not include a session token
 */
export async function loginAllKnower(
  url: string,
  email: string,
  password: string,
): Promise<{ token: string; user: unknown }> {
  const res = await akPublicFetch(url, "/api/auth/sign-in/email", {
    method: "POST",
    headers: { Origin: url },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ServiceError("UNAUTHORIZED", 401, `AllKnower login failed (${res.status})${body ? `: ${body}` : ""}`);
  }
  const token = res.headers.get("set-auth-token") ?? "";
  const data = await res.json().catch(() => ({}));
  if (!token) {
    throw new ServiceError("SERVICE_ERROR", 502, "AllKnower login did not return a session token.");
  }
  return { token, user: data.user ?? null };
}

/**
 * Register a new AllKnower account and obtain its session token and user record.
 *
 * @param url - The AllKnower base URL (used as the request origin)
 * @param email - The email address for the new account
 * @param password - The password for the new account
 * @param name - The display name for the new account
 * @returns An object containing `token` (the session token from the response header) and `user` (the parsed user payload or `null`)
 * @throws ServiceError when the registration request fails or the response does not include a session token
 */
export async function registerAllKnower(
  url: string,
  email: string,
  password: string,
  name: string,
): Promise<{ token: string; user: unknown }> {
  const res = await akPublicFetch(url, "/api/auth/sign-up/email", {
    method: "POST",
    headers: { Origin: url },
    body: JSON.stringify({ email, password, name }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ServiceError("SERVICE_ERROR", 502, `AllKnower registration failed (${res.status})${body ? `: ${body}` : ""}`);
  }
  const token = res.headers.get("set-auth-token") ?? "";
  const data = await res.json().catch(() => ({}));
  if (!token) {
    throw new ServiceError("SERVICE_ERROR", 502, "AllKnower registration did not return a session token.");
  }
  return { token, user: data.user ?? null };
}

/**
 * Fetches the current AllKnower session and associated user information.
 *
 * @returns `{ session: unknown; user: unknown }` — `session` is the session object or `null` if not present, and `user` is the user object or `null` if not present.
 */
export async function getAllKnowerSession(creds: AkCreds): Promise<{ session: unknown; user: unknown }> {
  const res = await akFetch(creds, "/api/auth/get-session", { method: "GET" });
  const data = await res.json().catch(() => ({}));
  return { session: data.session ?? null, user: data.user ?? null };
}

/**
 * Invalidates the session on the AllKnower server for the provided credentials.
 */
export async function logoutAllKnower(creds: AkCreds): Promise<void> {
  await akFetch(creds, "/api/auth/sign-out", { method: "POST", body: JSON.stringify({}) });
}

export interface AllCodexIntegrationStatus {
  connected: boolean;
  baseUrl?: string;
  tokenLast4?: string | null;
  updatedAt?: string;
}

/**
 * Connects an AllCodex integration using the provided base URL and token, and returns the updated integration status.
 *
 * @param baseUrl - The AllCodex instance base URL to connect
 * @param token - The integration token to register with AllCodex
 * @returns The integration status object containing `connected` and optional `baseUrl`, `tokenLast4`, and `updatedAt`
 */
export async function connectAllCodexIntegration(
  creds: AkCreds,
  baseUrl: string,
  token: string,
): Promise<AllCodexIntegrationStatus> {
  const res = await akFetch(creds, "/integrations/allcodex/connect", {
    method: "POST",
    body: JSON.stringify({ baseUrl, token }),
  });
  return res.json();
}

/**
 * Fetches the current AllCodex integration status.
 *
 * @returns An `AllCodexIntegrationStatus` object containing `connected` (whether integration is active) and optional `baseUrl`, `tokenLast4`, and `updatedAt` fields.
 */
export async function getAllCodexIntegrationStatus(creds: AkCreds): Promise<AllCodexIntegrationStatus> {
  const res = await akFetch(creds, "/integrations/allcodex/status");
  return res.json();
}

/**
 * Deletes the AllCodex integration for the authenticated account.
 *
 * @returns An object with `ok: true` if the deletion succeeded, `ok: false` otherwise.
 */
export async function deleteAllCodexIntegration(creds: AkCreds): Promise<{ ok: boolean }> {
  const res = await akFetch(creds, "/integrations/allcodex", { method: "DELETE" });
  return res.json();
}

/**
 * Retrieve AllCodex integration credentials for the portal.
 *
 * @param portalInternalSecret - Secret sent as `X-Portal-Internal-Secret` header to authenticate the request
 * @returns The AllCodex credentials: `baseUrl` and `token`
 */
export async function resolveAllCodexCredentials(
  creds: AkCreds,
  portalInternalSecret: string,
): Promise<{ baseUrl: string; token: string }> {
  const res = await akFetch(creds, "/internal/integrations/allcodex/credentials", {
    method: "POST",
    headers: { "X-Portal-Internal-Secret": portalInternalSecret },
    body: JSON.stringify({}),
  });
  return res.json();
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BrainDumpEntity {
  noteId: string;
  title: string;
  type: string;
}

export interface ProposedEntity {
  title: string;
  type: string;
  action: "create" | "update";
  content?: string;
  existingNoteId?: string;
}

export interface BrainDumpResult {
  mode?: "auto";
  summary: string;
  created: BrainDumpEntity[];
  updated: BrainDumpEntity[];
  skipped: Array<{ title: string; reason: string }>;
  duplicates?: Array<{
    proposedTitle: string;
    proposedType: string;
    matches: Array<{ noteId: string; title: string; score: number }>;
  }>;
}

export interface BrainDumpReviewResult {
  mode: "review";
  summary: string;
  proposedEntities: ProposedEntity[];
  duplicates?: Array<{
    proposedTitle: string;
    proposedType: string;
    matches: Array<{ noteId: string; title: string; score: number }>;
  }>;
}

export interface BrainDumpInboxResult {
  mode: "inbox";
  queued: true;
}

export type BrainDumpAnyResult = BrainDumpResult | BrainDumpReviewResult | BrainDumpInboxResult;

export interface BrainDumpHistoryEntry {
  id: string;
  rawText: string;
  summary: string | null;
  notesCreated: string[];
  notesUpdated: string[];
  model: string;
  tokensUsed: number | null;
  createdAt: string;
  entities: Array<{
    action: "created" | "updated";
    noteId: string;
    title: string;
    type: string;
  }> | null;
}

export interface BrainDumpDetailEntry extends BrainDumpHistoryEntry {
  parsedJson: {
    entities?: Array<{
      noteId: string;
      title: string;
      type: string;
      action: "created" | "updated";
    }>;
    summary?: string;
  } | null;
}

export interface RagChunk {
  noteId: string;
  noteTitle: string;
  content: string;
  score: number;
}

// ConsistencyIssue, ConsistencyResult, RelationshipSuggestion, GapArea, GapResult
// are now derived from Zod schemas in allknower-schemas.ts and re-exported from there.

/**
 * Run the Brain Dump flow against AllKnower and return the validated result.
 *
 * @param rawText - The source text to analyze and convert into entities/summary
 * @param mode - Processing mode: `"auto"` to apply changes automatically, `"review"` to return proposed entities for review, or `"inbox"` to queue the input
 * @param model - Optional model identifier to influence processing
 * @returns A `BrainDumpAnyResult` containing the parsed and schema-validated response from AllKnower
 * @throws ServiceError with code `SERVICE_ERROR` when the response does not match the expected schema
 */

export async function runBrainDump(
  creds: AkCreds,
  rawText: string,
  mode: "auto" | "review" | "inbox" = "auto",
  model?: string
): Promise<BrainDumpAnyResult> {
  const res = await akFetch(creds, "/brain-dump", {
    method: "POST",
    body: JSON.stringify({ rawText, mode, ...(model && { model }) }),
    signal: AbortSignal.timeout(180_000),
  });
  const raw = await res.json();
  const parsed = BrainDumpAnyResultSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[runBrainDump] AllKnower schema mismatch:", parsed.error.message);
    throw new ServiceError("SERVICE_ERROR", 502, "AllKnower returned an unexpected response format.");
  }
  return parsed.data;
}

/**
 * Commits a brain dump by sending approved entities to AllKnower and returning the finalized result.
 *
 * @param rawText - The original brain dump text submitted for commit
 * @param approvedEntities - The list of proposed entities to apply (create or update)
 * @returns The finalized `BrainDumpResult` containing summary, created/updated entries, skipped items, and optional duplicates
 * @throws ServiceError with code `SERVICE_ERROR` when AllKnower returns an unexpected response format
 */
export async function commitBrainDump(
  creds: AkCreds,
  rawText: string,
  approvedEntities: ProposedEntity[]
): Promise<BrainDumpResult> {
  const res = await akFetch(creds, "/brain-dump/commit", {
    method: "POST",
    body: JSON.stringify({ rawText, approvedEntities }),
    signal: AbortSignal.timeout(180_000),
  });
  const raw = await res.json();
  const parsed = BrainDumpResultSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[commitBrainDump] AllKnower schema mismatch:", parsed.error.message);
    throw new ServiceError("SERVICE_ERROR", 502, "AllKnower returned an unexpected response format.");
  }
  return parsed.data;
}

/**
 * Fetches a page of brain-dump history entries.
 *
 * @param cursor - Optional pagination cursor for the page to fetch
 * @returns An object containing `items` (the history entries), `nextCursor` (cursor for the next page, if present), and `hasMore` (`true` if a next page exists, `false` otherwise)
 */
export async function getBrainDumpHistory(
  creds: AkCreds,
  cursor?: string,
): Promise<{ items: BrainDumpHistoryEntry[]; nextCursor?: string; hasMore: boolean }> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  const qs = params.toString();
  const res = await akFetch(creds, `/brain-dump/history${qs ? `?${qs}` : ""}`);
  const data = await res.json();
  const items = data.items ?? (Array.isArray(data) ? data : []);
  return { items, nextCursor: data.nextCursor, hasMore: !!data.nextCursor };
}

/**
 * Fetches a brain dump history entry by its ID.
 *
 * @param id - The history entry identifier (will be URL-encoded)
 * @returns The requested BrainDumpDetailEntry parsed from the response body
 */
export async function getBrainDumpEntry(creds: AkCreds, id: string): Promise<BrainDumpDetailEntry> {
  const res = await akFetch(creds, `/brain-dump/history/${encodeURIComponent(id)}`);
  return res.json();
}

/**
 * Query the retrieval-augmented generation (RAG) index for chunks relevant to the provided text.
 *
 * @param text - The query text to search against the RAG index
 * @param topK - Maximum number of top-ranked chunks to return (default: 10)
 * @returns An array of `RagChunk` objects ranked by relevance; an empty array if no results are found
 */

export async function queryRag(creds: AkCreds, text: string, topK = 10): Promise<RagChunk[]> {
  const res = await akFetch(creds, "/rag/query", {
    method: "POST",
    body: JSON.stringify({ text, topK }),
  });
  const data = await res.json();
  return data.results ?? [];
}

/**
 * Sends an article-generation request to the Copilot endpoint and returns the validated chat response.
 *
 * @param payload - The Copilot request payload to send as the POST body.
 * @returns The validated Copilot chat response.
 * @throws ServiceError when the AllKnower response does not match the expected schema.
 */
export async function runArticleCopilot(
  creds: AkCreds,
  payload: CopilotRequest,
): Promise<CopilotChatResponse> {
  const res = await akFetch(creds, "/copilot/article", {
    method: "POST",
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120_000),
  });
  const raw = await res.json();
  const parsed = CopilotChatResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`[runArticleCopilot] AllKnower schema mismatch:`, parsed.error.message);
    throw new ServiceError("SERVICE_ERROR", 502, "AllKnower returned an unexpected response format.");
  }
  return parsed.data;
}

/**
 * Fetches the Retrieval-Augmented Generation (RAG) index status from the AllKnower server.
 *
 * @returns An object containing `indexedNotes` (the number of notes indexed), `lastIndexed` (ISO timestamp of the last indexing run or `null` if never indexed), and `model` (the name of the model used for RAG or `null` if unspecified).
 */
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

/**
 * Perform a consistency check for the specified notes against AllKnower.
 *
 * @param noteIds - Optional array of note IDs to limit the check; when omitted the check applies to all notes.
 * @returns The consistency check result validated against the `ConsistencyResult` schema.
 * @throws ServiceError with code `SERVICE_ERROR` if the response does not match the expected schema.
 */

export async function checkConsistency(creds: AkCreds, noteIds?: string[]): Promise<ConsistencyResult> {
  const res = await akFetch(creds, "/consistency/check", {
    method: "POST",
    body: JSON.stringify({ noteIds }),
    signal: AbortSignal.timeout(180_000),
  });
  const raw = await res.json();
  const parsed = ConsistencyResultSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`[checkConsistency] AllKnower schema mismatch:`, parsed.error.message);
    throw new ServiceError("SERVICE_ERROR", 502, "AllKnower returned an unexpected response format.");
  }
  return parsed.data;
}

/**
 * Suggests relationships based on input text, optionally scoped to a specific note.
 *
 * @param text - The text to analyze for relationship suggestions
 * @param noteId - Optional note ID to scope suggestions to a specific note
 * @returns A `RelationshipsResult` containing suggested relationships and related metadata
 * @throws ServiceError if the request fails or the response does not match the expected schema
 */
export async function suggestRelationships(creds: AkCreds, text: string, noteId?: string): Promise<RelationshipsResult> {
  const res = await akFetch(creds, "/suggest/relationships", {
    method: "POST",
    body: JSON.stringify({ text, ...(noteId ? { noteId } : {}) }),
    signal: AbortSignal.timeout(120_000),
  });
  const raw = await res.json();
  const parsed = RelationshipsResultSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`[suggestRelationships] AllKnower schema mismatch:`, parsed.error.message);
    throw new ServiceError("SERVICE_ERROR", 502, "AllKnower returned an unexpected response format.");
  }
  return parsed.data;
}

/**
 * Fetches a relationship graph rooted at the given note from AllKnower.
 *
 * @param noteId - The ID of the center note to build the graph around
 * @param depth - How many hops to traverse from the center note (default: 2)
 * @param maxNodes - Maximum number of nodes to include in the graph (default: 50)
 * @returns A `GraphResponse` containing nodes, edges, and metadata about the graph
 * @throws ServiceError with code `SERVICE_ERROR` if the response does not match the expected schema
 */
export async function getRelationshipGraph(
  creds: AkCreds,
  noteId: string,
  depth = 2,
  maxNodes = 50,
): Promise<GraphResponse> {
  const params = new URLSearchParams({
    depth: String(depth),
    maxNodes: String(maxNodes),
  });
  const res = await akFetch(
    creds,
    `/suggest/graph/${encodeURIComponent(noteId)}?${params}`,
    { signal: AbortSignal.timeout(30_000) },
  );
  const raw = await res.json();
  const parsed = GraphResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[getRelationshipGraph] AllKnower schema mismatch:", parsed.error.message);
    throw new ServiceError("SERVICE_ERROR", 502, "AllKnower returned an unexpected response format.");
  }
  return parsed.data;
}

/**
 * Fetches autocomplete suggestions for the given query from AllKnower.
 *
 * @param q - The query string to autocomplete
 * @returns The response's `suggestions` array if present, otherwise an empty array.
 */
export async function akFetchAutocomplete(creds: AkCreds, q: string): Promise<any[]> {
  const res = await akFetch(creds, `/suggest/autocomplete?q=${encodeURIComponent(q)}`);
  const data = await res.json();
  return data.suggestions ?? [];
}

/**
 * Apply a set of relationships from a source note to one or more target notes.
 *
 * @param sourceNoteId - ID of the note from which relationships originate
 * @param relations - Array of relationship objects; each must include `targetNoteId` and `relationshipType`, and may include `description`
 * @param bidirectional - If `true`, create relationships in both directions; defaults to `true`
 * @returns The server-validated result of the apply operation (`ApplyRelationshipsResult`)
 * @throws ServiceError when the AllKnower response does not match the expected schema
 */
export async function applyRelationships(
  creds: AkCreds,
  sourceNoteId: string,
  relations: Array<{ targetNoteId: string; relationshipType: string; description?: string }>,
  bidirectional = true
): Promise<ApplyRelationshipsResult> {
  const res = await akFetch(creds, "/suggest/relationships/apply", {
    method: "POST",
    body: JSON.stringify({ sourceNoteId, relations, bidirectional }),
    signal: AbortSignal.timeout(120_000),
  });
  const raw = await res.json();
  const parsed = ApplyRelationshipsResultSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`[applyRelationships] AllKnower schema mismatch:`, parsed.error.message);
    throw new ServiceError("SERVICE_ERROR", 502, "AllKnower returned an unexpected response format.");
  }
  return parsed.data;
}

/**
 * Retrieves gap analysis results from AllKnower.
 *
 * @returns The gap analysis result containing identified gap areas and related metadata.
 * @throws ServiceError with code `"SERVICE_ERROR"` and status `502` if the server response does not match the expected schema.
 */
export async function getGaps(creds: AkCreds): Promise<GapResult> {
  const res = await akFetch(creds, "/suggest/gaps", {
    method: "POST",
    signal: AbortSignal.timeout(120_000),
  });
  const raw = await res.json();
  const parsed = GapResultSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`[getGaps] AllKnower schema mismatch:`, parsed.error.message);
    throw new ServiceError("SERVICE_ERROR", 502, "AllKnower returned an unexpected response format.");
  }
  return parsed.data;
}

/**
 * Fetches the service health status from the AllKnower API.
 *
 * @returns An object with `status`, `allcodex`, and `ollama` fields, each a string.
 */
export async function getHealth(creds: AkCreds): Promise<{ status: string; allcodex: string; ollama: string }> {
  const res = await akFetch(creds, "/health");
  return res.json();
}

export interface ModelChainConfig {
  models: string[];
  autoMode: boolean;
}

/**
 * Retrieves model chain configurations keyed by chain identifier.
 *
 * @returns A record mapping chain names to `ModelChainConfig` objects.
 */
export async function getModelChains(creds: AkCreds): Promise<Record<string, ModelChainConfig>> {
  const res = await akFetch(creds, "/config/models");
  return res.json();
}

/**
 * Fetches the relationship history for a given note from AllKnower.
 *
 * @param noteId - The ID of the note to fetch history for
 * @param limit - Maximum number of entries to return (default: 20)
 * @returns An object with `entries` array of relationship history records
 * @throws ServiceError with code `SERVICE_ERROR` if the response does not match the expected schema
 */
export async function getRelationshipHistory(
  creds: AkCreds,
  noteId: string,
  limit = 20,
): Promise<{ entries: RelationHistoryEntry[] }> {
  const params = new URLSearchParams({ limit: String(limit) });
  const res = await akFetch(
    creds,
    `/suggest/history/${encodeURIComponent(noteId)}?${params}`,
  );
  const raw = await res.json();
  const parsed = RelationHistoryResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[getRelationshipHistory] schema mismatch:", parsed.error.message);
    throw new ServiceError("SERVICE_ERROR", 502, "AllKnower returned an unexpected response format.");
  }
  return parsed.data;
}

/**
 * Fetches LLM call and token metrics from AllKnower.
 */
export async function getMetricsLLM(creds: AkCreds): Promise<MetricsLLMResult> {
  const res = await akFetch(creds, "/metrics/llm");
  const raw = await res.json();
  const parsed = MetricsLLMResultSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[getMetricsLLM] AllKnower schema mismatch:", parsed.error.message);
    throw new ServiceError("SERVICE_ERROR", 502, "AllKnower returned an unexpected response format.");
  }
  return parsed.data;
}

export async function subscribeNotifications(
  creds: AkCreds,
  subscription: PushSubscriptionPayload,
): Promise<{ ok: boolean }> {
  const res = await akFetch(creds, "/notifications/subscribe", {
    method: "POST",
    body: JSON.stringify(subscription),
  });
  return res.json();
}

export async function unsubscribeNotifications(creds: AkCreds, endpoint: string): Promise<{ ok: boolean }> {
  const res = await akFetch(creds, "/notifications/unsubscribe", {
    method: "DELETE",
    body: JSON.stringify({ endpoint }),
  });
  return res.json();
}

// ── Bulk Brain Dump ─────────────────────────────────────────────────────────

export async function submitBrainDumpBatch(
  creds: AkCreds,
  items: Array<{ rawText: string; parentNoteId?: string; mode?: "auto" | "review" }>,
): Promise<BrainDumpBatchSubmitResult> {
  const res = await akFetch(creds, "/brain-dump/batch", {
    method: "POST",
    body: JSON.stringify({ items }),
    signal: AbortSignal.timeout(30_000),
  });
  const raw = await res.json();
  const parsed = BrainDumpBatchSubmitResultSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[submitBrainDumpBatch] AllKnower schema mismatch:", parsed.error.message);
    throw new ServiceError("SERVICE_ERROR", 502, "AllKnower returned an unexpected response format.");
  }
  return parsed.data;
}

export async function getBrainDumpBatch(creds: AkCreds, batchId: string): Promise<BrainDumpBatch> {
  const res = await akFetch(creds, `/brain-dump/batch/${batchId}`);
  const raw = await res.json();
  const parsed = BrainDumpBatchSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[getBrainDumpBatch] AllKnower schema mismatch:", parsed.error.message);
    throw new ServiceError("SERVICE_ERROR", 502, "AllKnower returned an unexpected response format.");
  }
  return parsed.data;
}

export async function cancelBrainDumpBatch(creds: AkCreds, batchId: string): Promise<{ cancelled: number }> {
  const res = await akFetch(creds, `/brain-dump/batch/${batchId}`, { method: "DELETE" });
  return res.json();
}

// ── Brain Dump Diffs ────────────────────────────────────────────────────────

export async function getBrainDumpDiffs(creds: AkCreds, historyId: string): Promise<BrainDumpDiffsResponse> {
  const res = await akFetch(creds, `/brain-dump/history/${historyId}/diffs`);
  const raw = await res.json();
  const parsed = BrainDumpDiffsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[getBrainDumpDiffs] AllKnower schema mismatch:", parsed.error.message);
    throw new ServiceError("SERVICE_ERROR", 502, "AllKnower returned an unexpected response format.");
  }
  return parsed.data;
}

// ── Usage / Observability ─────────────────────────────────────────────────────

export async function getUsageSummary(
  creds: AkCreds,
  from?: string,
  to?: string,
): Promise<UsageSummary> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString();
  const res = await akFetch(creds, `/usage/summary${qs ? `?${qs}` : ""}`);
  const raw = await res.json();
  const parsed = UsageSummarySchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[getUsageSummary] AllKnower schema mismatch:", parsed.error.message);
    throw new ServiceError("SERVICE_ERROR", 502, "AllKnower returned an unexpected response format.");
  }
  return parsed.data;
}

export async function getUserBudget(creds: AkCreds): Promise<UserBudget> {
  const res = await akFetch(creds, "/usage/budgets");
  const raw = await res.json();
  const parsed = UserBudgetSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[getUserBudget] AllKnower schema mismatch:", parsed.error.message);
    throw new ServiceError("SERVICE_ERROR", 502, "AllKnower returned an unexpected response format.");
  }
  return parsed.data;
}

export async function putUserBudget(
  creds: AkCreds,
  budget: { dailyBudgetUsd?: number | null; monthlyBudgetUsd?: number | null; alertEmail?: string | null },
): Promise<void> {
  await akFetch(creds, "/usage/budgets", {
    method: "PUT",
    body: JSON.stringify(budget),
  });
}

export async function getUsageAlertStatus(creds: AkCreds): Promise<UsageAlertStatus> {
  const res = await akFetch(creds, "/usage/alert-status");
  const raw = await res.json();
  const parsed = UsageAlertStatusSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[getUsageAlertStatus] AllKnower schema mismatch:", parsed.error.message);
    throw new ServiceError("SERVICE_ERROR", 502, "AllKnower returned an unexpected response format.");
  }
  return parsed.data;
}

