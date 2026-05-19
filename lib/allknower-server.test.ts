import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceError } from "./route-error";

// ── Fetch mock ────────────────────────────────────────────────────────────────

const mockFetch = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", mockFetch);

function makeOkResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

function makeErrorResponse(status: number, body = ""): Response {
  return {
    ok: false,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(String(body)),
  } as unknown as Response;
}

function makeAuthResponse(token: string, body: unknown): Response {
  const headers = new Headers();
  headers.set("set-auth-token", token);
  return {
    ok: true,
    status: 200,
    headers,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

const creds = { url: "http://allknower.test", token: "test-token" };

// ── Import after stubbing globals ─────────────────────────────────────────────

import {
  getBrainDumpHistory,
  getBrainDumpEntry,
  runBrainDump,
  commitBrainDump,
  queryRag,
  getHealth,
  loginAllKnower,
  registerAllKnower,
  getAllKnowerSession,
  logoutAllKnower,
  connectAllCodexIntegration,
  getAllCodexIntegrationStatus,
  deleteAllCodexIntegration,
  resolveAllCodexCredentials,
  checkConsistency,
  suggestRelationships,
  applyRelationships,
  getGaps,
  runArticleCopilot,
  getRagStatus,
  triggerReindex,
  akFetchAutocomplete,
} from "./allknower-server";

describe("allknower-server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  // ── getBrainDumpHistory ────────────────────────────────────────────────────

  describe("getBrainDumpHistory", () => {
    const entry = {
      id: "hist-1",
      rawText: "The wardens swore the Vault Oath.",
      summary: "Vault Oath captured.",
      notesCreated: ["note-1"],
      notesUpdated: [],
      model: "gpt-4o-mini",
      tokensUsed: 312,
      createdAt: new Date().toISOString(),
      entities: null,
    };

    it("handles a flat array response (legacy format)", async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse([entry]));

      const result = await getBrainDumpHistory(creds);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe("hist-1");
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeUndefined();
    });

    it("handles a paginated { items, nextCursor } response", async () => {
      mockFetch.mockResolvedValueOnce(
        makeOkResponse({ items: [entry], nextCursor: "cur_abc" })
      );

      const result = await getBrainDumpHistory(creds);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe("hist-1");
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe("cur_abc");
    });

    it("returns empty items when items is empty", async () => {
      mockFetch.mockResolvedValueOnce(
        makeOkResponse({ items: [] })
      );

      const result = await getBrainDumpHistory(creds);

      expect(result.items).toEqual([]);
      expect(result.hasMore).toBe(false);
    });

    it("returns empty items for flat empty array response", async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse([]));

      const result = await getBrainDumpHistory(creds);

      expect(result.items).toEqual([]);
      expect(result.hasMore).toBe(false);
    });

    it("forwards cursor as query parameter", async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({ items: [] }));

      await getBrainDumpHistory(creds, "cur_xyz");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/brain-dump/history?cursor=cur_xyz"),
        expect.anything(),
      );
    });

    it("throws ServiceError on 401", async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(401));

      await expect(getBrainDumpHistory(creds)).rejects.toThrow(ServiceError);
    });

    it("throws ServiceError on 502", async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(502, "bad gateway"));

      await expect(getBrainDumpHistory(creds)).rejects.toThrow(ServiceError);
    });

    it("throws ServiceError when fetch rejects (network error)", async () => {
      mockFetch.mockRejectedValueOnce(new TypeError("Network failure"));

      await expect(getBrainDumpHistory(creds)).rejects.toThrow(ServiceError);
    });
  });

  // ── getBrainDumpEntry ──────────────────────────────────────────────────────

  describe("getBrainDumpEntry", () => {
    it("fetches the correct entry by id", async () => {
      const detail = {
        id: "hist-99",
        rawText: "A dark pact was forged.",
        summary: "Pact documented.",
        notesCreated: [],
        notesUpdated: ["note-5"],
        model: "gpt-4o",
        tokensUsed: 88,
        createdAt: new Date().toISOString(),
        entities: null,
        parsedJson: null,
      };
      mockFetch.mockResolvedValueOnce(makeOkResponse(detail));

      const result = await getBrainDumpEntry(creds, "hist-99");

      expect(result.id).toBe("hist-99");
      expect(result.rawText).toBe("A dark pact was forged.");
      // Verify the URL was constructed correctly (id must be encoded)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/brain-dump/history/hist-99"),
        expect.any(Object)
      );
    });
  });

  // ── runBrainDump ──────────────────────────────────────────────────────────

  describe("runBrainDump", () => {
    it("sends rawText and mode, returns result", async () => {
      const brainResult = {
        mode: "auto",
        summary: "Created 1 note.",
        created: [{ noteId: "n1", title: "Vault Oath", type: "event" }],
        updated: [],
        skipped: [],
      };
      mockFetch.mockResolvedValueOnce(makeOkResponse(brainResult));

      const result = await runBrainDump(creds, "The wardens swore the Vault Oath.", "auto");

      expect(result).toMatchObject({ mode: "auto", summary: "Created 1 note." });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/brain-dump"),
        expect.objectContaining({ method: "POST" })
      );
    });

    it("defaults mode to auto when not specified", async () => {
      mockFetch.mockResolvedValueOnce(
        makeOkResponse({ mode: "auto", summary: "ok", created: [], updated: [], skipped: [] })
      );

      await runBrainDump(creds, "some text");

      const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      expect(body.mode).toBe("auto");
    });
  });

  // ── commitBrainDump ───────────────────────────────────────────────────────

  describe("commitBrainDump", () => {
    it("POSTs to /brain-dump/commit with approved entities", async () => {
      const commitResult = {
        mode: "auto",
        summary: "Committed.",
        created: [],
        updated: [],
        skipped: [],
      };
      mockFetch.mockResolvedValueOnce(makeOkResponse(commitResult));

      await commitBrainDump(creds, "text", []);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/brain-dump/commit"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  // ── queryRag ──────────────────────────────────────────────────────────────

  describe("queryRag", () => {
    it("returns results array from { results } response", async () => {
      const chunks = [
        { noteId: "n1", noteTitle: "Vault Oath", content: "The wardens...", score: 0.92 },
      ];
      mockFetch.mockResolvedValueOnce(makeOkResponse({ results: chunks }));

      const result = await queryRag(creds, "vault oath");

      expect(result).toHaveLength(1);
      expect(result[0].noteId).toBe("n1");
    });

    it("returns empty array when results key is absent", async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({}));

      const result = await queryRag(creds, "anything");

      expect(result).toEqual([]);
    });
  });

  // ── getHealth ─────────────────────────────────────────────────────────────

  describe("getHealth", () => {
    it("returns health status object", async () => {
      mockFetch.mockResolvedValueOnce(
        makeOkResponse({ status: "ok", allcodex: "ok", ollama: "ok" })
      );

      const result = await getHealth(creds);

      expect(result.status).toBe("ok");
    });
  });

  // ── loginAllKnower ────────────────────────────────────────────────────────

  describe("loginAllKnower", () => {
    const url = "http://allknower.test";

    it("returns token and user on success", async () => {
      mockFetch.mockResolvedValueOnce(
        makeAuthResponse("tok_abc123", { user: { id: "u1", name: "Alice" } })
      );

      const result = await loginAllKnower(url, "alice@example.com", "secret");

      expect(result.token).toBe("tok_abc123");
      expect(result.user).toEqual({ id: "u1", name: "Alice" });
      expect(mockFetch).toHaveBeenCalledWith(
        `${url}/api/auth/sign-in/email`,
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("throws ServiceError UNAUTHORIZED when response is not ok", async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(403, "bad creds"));

      await expect(loginAllKnower(url, "a@b.com", "wrong")).rejects.toThrow(ServiceError);
      try {
        mockFetch.mockResolvedValueOnce(makeErrorResponse(403, "bad creds"));
        await loginAllKnower(url, "a@b.com", "wrong");
      } catch (err) {
        expect(err).toBeInstanceOf(ServiceError);
        expect((err as ServiceError).code).toBe("UNAUTHORIZED");
        expect((err as ServiceError).httpStatus).toBe(401);
      }
    });

    it("throws ServiceError SERVICE_ERROR when token header is missing", async () => {
      // ok: true but no set-auth-token header
      mockFetch.mockResolvedValueOnce(
        makeAuthResponse("", { user: { id: "u1" } })
      );

      await expect(loginAllKnower(url, "a@b.com", "pass")).rejects.toThrow(ServiceError);
      try {
        mockFetch.mockResolvedValueOnce(makeAuthResponse("", { user: { id: "u1" } }));
        await loginAllKnower(url, "a@b.com", "pass");
      } catch (err) {
        expect(err).toBeInstanceOf(ServiceError);
        expect((err as ServiceError).code).toBe("SERVICE_ERROR");
        expect((err as ServiceError).httpStatus).toBe(502);
      }
    });

    it("throws ServiceError UNREACHABLE on network error", async () => {
      mockFetch.mockRejectedValueOnce(new TypeError("fetch failed"));

      await expect(loginAllKnower(url, "a@b.com", "pass")).rejects.toThrow(ServiceError);
      try {
        mockFetch.mockRejectedValueOnce(new TypeError("fetch failed"));
        await loginAllKnower(url, "a@b.com", "pass");
      } catch (err) {
        expect(err).toBeInstanceOf(ServiceError);
        expect((err as ServiceError).code).toBe("UNREACHABLE");
        expect((err as ServiceError).httpStatus).toBe(503);
      }
    });
  });

  // ── registerAllKnower ─────────────────────────────────────────────────────

  describe("registerAllKnower", () => {
    const url = "http://allknower.test";

    it("returns token and user on success", async () => {
      mockFetch.mockResolvedValueOnce(
        makeAuthResponse("tok_reg1", { user: { id: "u2", name: "Bob" } })
      );

      const result = await registerAllKnower(url, "bob@example.com", "pass123", "Bob");

      expect(result.token).toBe("tok_reg1");
      expect(result.user).toEqual({ id: "u2", name: "Bob" });
      expect(mockFetch).toHaveBeenCalledWith(
        `${url}/api/auth/sign-up/email`,
        expect.objectContaining({ method: "POST" }),
      );
      const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      expect(body).toEqual({ email: "bob@example.com", password: "pass123", name: "Bob" });
    });

    it("throws ServiceError when token header is missing", async () => {
      mockFetch.mockResolvedValueOnce(
        makeAuthResponse("", { user: { id: "u2" } })
      );

      try {
        await registerAllKnower(url, "bob@b.com", "pass", "Bob");
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ServiceError);
        expect((err as ServiceError).code).toBe("SERVICE_ERROR");
        expect((err as ServiceError).httpStatus).toBe(502);
      }
    });

    it("throws ServiceError when response is not ok", async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(409, "email taken"));

      try {
        await registerAllKnower(url, "bob@b.com", "pass", "Bob");
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ServiceError);
        expect((err as ServiceError).code).toBe("SERVICE_ERROR");
        expect((err as ServiceError).httpStatus).toBe(502);
        expect((err as ServiceError).message).toContain("registration failed");
      }
    });

    it("throws ServiceError UNREACHABLE on network error", async () => {
      mockFetch.mockRejectedValueOnce(new TypeError("fetch failed"));

      await expect(
        registerAllKnower(url, "bob@b.com", "pass", "Bob")
      ).rejects.toThrow(ServiceError);
    });
  });

  // ── getAllKnowerSession ───────────────────────────────────────────────────

  describe("getAllKnowerSession", () => {
    it("returns session and user from response", async () => {
      mockFetch.mockResolvedValueOnce(
        makeOkResponse({ session: { id: "sess1", expiresAt: "2026-12-31" }, user: { id: "u1", name: "Alice" } })
      );

      const result = await getAllKnowerSession(creds);

      expect(result.session).toEqual({ id: "sess1", expiresAt: "2026-12-31" });
      expect(result.user).toEqual({ id: "u1", name: "Alice" });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/auth/get-session"),
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("returns null session/user when response is empty object", async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({}));

      const result = await getAllKnowerSession(creds);

      expect(result.session).toBeNull();
      expect(result.user).toBeNull();
    });

    it("throws ServiceError on 401", async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(401));

      await expect(getAllKnowerSession(creds)).rejects.toThrow(ServiceError);
    });
  });

  // ── logoutAllKnower ───────────────────────────────────────────────────────

  describe("logoutAllKnower", () => {
    it("calls POST /api/auth/sign-out", async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({}));

      await logoutAllKnower(creds);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/auth/sign-out"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("returns void (no return value)", async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({}));

      const result = await logoutAllKnower(creds);

      expect(result).toBeUndefined();
    });

    it("throws ServiceError on 401", async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(401));

      await expect(logoutAllKnower(creds)).rejects.toThrow(ServiceError);
    });
  });

  // ── connectAllCodexIntegration ────────────────────────────────────────────

  describe("connectAllCodexIntegration", () => {
    it("POSTs to /integrations/allcodex/connect and returns status", async () => {
      const status = { connected: true, baseUrl: "http://core:8080", tokenLast4: "abcd", updatedAt: "2026-01-01" };
      mockFetch.mockResolvedValueOnce(makeOkResponse(status));

      const result = await connectAllCodexIntegration(creds, "http://core:8080", "core-token");

      expect(result).toEqual(status);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/integrations/allcodex/connect"),
        expect.objectContaining({ method: "POST" }),
      );
      const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      expect(body).toEqual({ baseUrl: "http://core:8080", token: "core-token" });
    });

    it("throws ServiceError on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(500, "server error"));

      await expect(
        connectAllCodexIntegration(creds, "http://core:8080", "tok")
      ).rejects.toThrow(ServiceError);
    });
  });

  // ── getAllCodexIntegrationStatus ──────────────────────────────────────────

  describe("getAllCodexIntegrationStatus", () => {
    it("GETs /integrations/allcodex/status and returns status", async () => {
      const status = { connected: true, baseUrl: "http://core:8080", tokenLast4: "xyz1", updatedAt: "2026-05-01" };
      mockFetch.mockResolvedValueOnce(makeOkResponse(status));

      const result = await getAllCodexIntegrationStatus(creds);

      expect(result).toEqual(status);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/integrations/allcodex/status"),
        expect.anything(),
      );
    });

    it("returns disconnected status", async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({ connected: false }));

      const result = await getAllCodexIntegrationStatus(creds);

      expect(result.connected).toBe(false);
    });

    it("throws ServiceError on 401", async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(401));

      await expect(getAllCodexIntegrationStatus(creds)).rejects.toThrow(ServiceError);
    });
  });

  // ── deleteAllCodexIntegration ─────────────────────────────────────────────

  describe("deleteAllCodexIntegration", () => {
    it("sends DELETE to /integrations/allcodex and returns { ok: true }", async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({ ok: true }));

      const result = await deleteAllCodexIntegration(creds);

      expect(result).toEqual({ ok: true });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/integrations/allcodex"),
        expect.objectContaining({ method: "DELETE" }),
      );
    });

    it("throws ServiceError on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(500));

      await expect(deleteAllCodexIntegration(creds)).rejects.toThrow(ServiceError);
    });
  });

  // ── resolveAllCodexCredentials ────────────────────────────────────────────

  describe("resolveAllCodexCredentials", () => {
    it("POSTs with X-Portal-Internal-Secret header and returns credentials", async () => {
      const credsResult = { baseUrl: "http://core:8080", token: "core-secret-tok" };
      mockFetch.mockResolvedValueOnce(makeOkResponse(credsResult));

      const result = await resolveAllCodexCredentials(creds, "internal-secret-123");

      expect(result).toEqual(credsResult);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/internal/integrations/allcodex/credentials"),
        expect.objectContaining({ method: "POST" }),
      );
      // Verify the internal secret header was passed in init.headers
      const callInit = mockFetch.mock.calls[0][1] as RequestInit;
      // buildJsonHeaders merges init.headers — check the final headers object
      const headers = new Headers(callInit.headers);
      expect(headers.get("X-Portal-Internal-Secret")).toBe("internal-secret-123");
    });

    it("throws ServiceError on 401", async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(401));

      await expect(
        resolveAllCodexCredentials(creds, "bad-secret")
      ).rejects.toThrow(ServiceError);
    });
  });

  // ── checkConsistency ──────────────────────────────────────────────────────

  describe("checkConsistency", () => {
    const validResponse = {
      issues: [{
        type: "contradiction",
        severity: "high",
        description: "Conflicting dates for the Great War",
        affectedNoteIds: ["n1", "n2"],
      }],
      summary: "1 consistency issue found",
    };

    it("returns Zod-parsed result on valid data", async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse(validResponse));

      const result = await checkConsistency(creds);

      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].type).toBe("contradiction");
      expect(result.issues[0].severity).toBe("high");
      expect(result.summary).toBe("1 consistency issue found");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/consistency/check"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("forwards noteIds in the request body", async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({ issues: [], summary: "No issues" }));

      await checkConsistency(creds, ["n1", "n2"]);

      const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      expect(body.noteIds).toEqual(["n1", "n2"]);
    });

    it("throws ServiceError 502 on schema mismatch (missing issues)", async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({ wrong: "shape" }));

      await expect(checkConsistency(creds)).rejects.toThrow(ServiceError);
      try {
        mockFetch.mockResolvedValueOnce(makeOkResponse({ wrong: "shape" }));
        await checkConsistency(creds);
      } catch (err) {
        expect(err).toBeInstanceOf(ServiceError);
        expect((err as ServiceError).httpStatus).toBe(502);
      }
    });

    it("throws ServiceError on network error", async () => {
      mockFetch.mockRejectedValueOnce(new TypeError("fetch failed"));

      await expect(checkConsistency(creds)).rejects.toThrow(ServiceError);
    });
  });

  // ── suggestRelationships ──────────────────────────────────────────────────

  describe("suggestRelationships", () => {
    const validResponse = {
      suggestions: [{
        targetNoteId: "n2",
        targetTitle: "Bob the Brave",
        relationshipType: "ally",
        description: "They fought together in the war",
        confidence: "high",
      }],
    };

    it("returns Zod-parsed result on valid data", async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse(validResponse));

      const result = await suggestRelationships(creds, "Alice is an ally of Bob");

      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].targetNoteId).toBe("n2");
      expect(result.suggestions[0].relationshipType).toBe("ally");
      expect(result.suggestions[0].confidence).toBe("high");
    });

    it("includes noteId in request body when provided", async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({ suggestions: [] }));

      await suggestRelationships(creds, "some text", "n5");

      const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      expect(body.noteId).toBe("n5");
      expect(body.text).toBe("some text");
    });

    it("omits noteId from request body when not provided", async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({ suggestions: [] }));

      await suggestRelationships(creds, "some text");

      const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      expect(body).not.toHaveProperty("noteId");
      expect(body.text).toBe("some text");
    });

    it("throws ServiceError 502 on schema mismatch", async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({ wrong: "shape" }));

      await expect(suggestRelationships(creds, "text")).rejects.toThrow(ServiceError);
      try {
        mockFetch.mockResolvedValueOnce(makeOkResponse({ wrong: "shape" }));
        await suggestRelationships(creds, "text");
      } catch (err) {
        expect(err).toBeInstanceOf(ServiceError);
        expect((err as ServiceError).httpStatus).toBe(502);
      }
    });

    it("throws ServiceError on network error", async () => {
      mockFetch.mockRejectedValueOnce(new TypeError("fetch failed"));

      await expect(suggestRelationships(creds, "text")).rejects.toThrow(ServiceError);
    });
  });

  // ── applyRelationships ────────────────────────────────────────────────────

  describe("applyRelationships", () => {
    const validResponse = {
      applied: [{ sourceNoteId: "n1", targetNoteId: "n2", relationshipType: "ally", relationName: "relAlly" }],
      skipped: [],
      failed: [],
    };

    it("returns Zod-parsed result on valid data", async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse(validResponse));

      const relations = [{ targetNoteId: "n2", relationshipType: "ally", description: "Allies" }];
      const result = await applyRelationships(creds, "n1", relations);

      expect(result.applied).toHaveLength(1);
      expect(result.applied[0].relationName).toBe("relAlly");
      expect(result.skipped).toEqual([]);
      expect(result.failed).toEqual([]);
    });

    it("sends sourceNoteId, relations, and bidirectional in request body", async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({ applied: [], skipped: [], failed: [] }));

      const relations = [{ targetNoteId: "n2", relationshipType: "enemy" }];
      await applyRelationships(creds, "n1", relations, false);

      const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      expect(body.sourceNoteId).toBe("n1");
      expect(body.relations).toEqual(relations);
      expect(body.bidirectional).toBe(false);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/suggest/relationships/apply"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("throws ServiceError 502 on schema mismatch", async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({ wrong: "shape" }));

      await expect(
        applyRelationships(creds, "n1", [{ targetNoteId: "n2", relationshipType: "ally" }])
      ).rejects.toThrow(ServiceError);
      try {
        mockFetch.mockResolvedValueOnce(makeOkResponse({ wrong: "shape" }));
        await applyRelationships(creds, "n1", [{ targetNoteId: "n2", relationshipType: "ally" }]);
      } catch (err) {
        expect(err).toBeInstanceOf(ServiceError);
        expect((err as ServiceError).httpStatus).toBe(502);
      }
    });

    it("throws ServiceError on network error", async () => {
      mockFetch.mockRejectedValueOnce(new TypeError("fetch failed"));

      await expect(
        applyRelationships(creds, "n1", [{ targetNoteId: "n2", relationshipType: "ally" }])
      ).rejects.toThrow(ServiceError);
    });
  });

  // ── getGaps ───────────────────────────────────────────────────────────────

  describe("getGaps", () => {
    const validResponse = {
      gaps: [{
        area: "Character Backstory",
        severity: "medium",
        description: "Missing backstory for several key characters",
        suggestion: "Add backstory sections to character notes",
      }],
      summary: "1 gap area identified",
    };

    it("returns Zod-parsed result on valid data", async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse(validResponse));

      const result = await getGaps(creds);

      expect(result.gaps).toHaveLength(1);
      expect(result.gaps[0].area).toBe("Character Backstory");
      expect(result.gaps[0].severity).toBe("medium");
      expect(result.summary).toBe("1 gap area identified");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/suggest/gaps"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("accepts optional typeCounts and totalNotes", async () => {
      const withOptionals = {
        ...validResponse,
        typeCounts: { character: 5, event: 3 },
        totalNotes: 8,
      };
      mockFetch.mockResolvedValueOnce(makeOkResponse(withOptionals));

      const result = await getGaps(creds);

      expect(result.typeCounts).toEqual({ character: 5, event: 3 });
      expect(result.totalNotes).toBe(8);
    });

    it("throws ServiceError 502 on schema mismatch", async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({ wrong: "shape" }));

      await expect(getGaps(creds)).rejects.toThrow(ServiceError);
      try {
        mockFetch.mockResolvedValueOnce(makeOkResponse({ wrong: "shape" }));
        await getGaps(creds);
      } catch (err) {
        expect(err).toBeInstanceOf(ServiceError);
        expect((err as ServiceError).httpStatus).toBe(502);
      }
    });

    it("throws ServiceError on network error", async () => {
      mockFetch.mockRejectedValueOnce(new TypeError("fetch failed"));

      await expect(getGaps(creds)).rejects.toThrow(ServiceError);
    });
  });

  // ── runArticleCopilot ─────────────────────────────────────────────────────

  describe("runArticleCopilot", () => {
    const validPayload = {
      noteId: "n1",
      transcript: [{ role: "user" as const, content: "Expand the backstory" }],
      currentNote: {
        noteId: "n1",
        title: "Dark Pact",
        loreType: "event",
        contentHtml: "<p>A dark pact was forged.</p>",
        parentNoteIds: ["root"],
        labels: [{ name: "type", value: "event" }],
        relations: [],
      },
      linkedNotes: [],
      ragContext: [],
      writableTargetIds: ["n1"],
    };

    const validResponse = {
      assistantMessage: "Here's an expanded backstory for the Dark Pact.",
      citations: [{ noteId: "n1", title: "Dark Pact", source: "current" }],
      proposal: null,
    };

    it("returns Zod-parsed result on valid data", async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse(validResponse));

      const result = await runArticleCopilot(creds, validPayload);

      expect(result.assistantMessage).toBe("Here's an expanded backstory for the Dark Pact.");
      expect(result.citations).toHaveLength(1);
      expect(result.proposal).toBeNull();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/copilot/article"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("accepts response with a proposal", async () => {
      const withProposal = {
        assistantMessage: "I suggest updating the content.",
        citations: [],
        proposal: {
          targets: [{
            kind: "update",
            targetId: "n1",
            contentHtml: "<p>Updated content</p>",
            labelUpserts: [],
            labelDeletes: [],
            relationAdds: [],
            relationDeletes: [],
            rationale: "Expanding backstory",
          }],
        },
      };
      mockFetch.mockResolvedValueOnce(makeOkResponse(withProposal));

      const result = await runArticleCopilot(creds, validPayload);

      expect(result.proposal).not.toBeNull();
      expect(result.proposal!.targets).toHaveLength(1);
      expect(result.proposal!.targets[0].kind).toBe("update");
    });

    it("throws ServiceError 502 on schema mismatch", async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({ wrong: "shape" }));

      await expect(runArticleCopilot(creds, validPayload)).rejects.toThrow(ServiceError);
      try {
        mockFetch.mockResolvedValueOnce(makeOkResponse({ wrong: "shape" }));
        await runArticleCopilot(creds, validPayload);
      } catch (err) {
        expect(err).toBeInstanceOf(ServiceError);
        expect((err as ServiceError).httpStatus).toBe(502);
      }
    });

    it("throws ServiceError on network error", async () => {
      mockFetch.mockRejectedValueOnce(new TypeError("fetch failed"));

      await expect(runArticleCopilot(creds, validPayload)).rejects.toThrow(ServiceError);
    });
  });

  // ── getRagStatus ──────────────────────────────────────────────────────────

  describe("getRagStatus", () => {
    it("returns indexed notes count and metadata", async () => {
      const status = { indexedNotes: 42, lastIndexed: "2026-05-01T12:00:00Z", model: "text-embedding-3-large" };
      mockFetch.mockResolvedValueOnce(makeOkResponse(status));

      const result = await getRagStatus(creds);

      expect(result.indexedNotes).toBe(42);
      expect(result.lastIndexed).toBe("2026-05-01T12:00:00Z");
      expect(result.model).toBe("text-embedding-3-large");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/rag/status"),
        expect.anything(),
      );
    });

    it("handles null lastIndexed and model", async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({ indexedNotes: 0, lastIndexed: null, model: null }));

      const result = await getRagStatus(creds);

      expect(result.indexedNotes).toBe(0);
      expect(result.lastIndexed).toBeNull();
      expect(result.model).toBeNull();
    });

    it("throws ServiceError on 401", async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(401));

      await expect(getRagStatus(creds)).rejects.toThrow(ServiceError);
    });
  });

  // ── triggerReindex ────────────────────────────────────────────────────────

  describe("triggerReindex", () => {
    it("POSTs to /rag/reindex when no noteId is given", async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({ ok: true }));

      const result = await triggerReindex(creds);

      expect(result).toEqual({ ok: true });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/rag/reindex"),
        expect.objectContaining({ method: "POST" }),
      );
      // Ensure the URL does NOT contain a note ID segment
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toBe("http://allknower.test/rag/reindex");
    });

    it("POSTs to /rag/reindex/{noteId} when noteId is given", async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({ ok: true }));

      const result = await triggerReindex(creds, "n1");

      expect(result).toEqual({ ok: true });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toBe("http://allknower.test/rag/reindex/n1");
    });

    it("throws ServiceError on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(500));

      await expect(triggerReindex(creds)).rejects.toThrow(ServiceError);
    });

    it("throws ServiceError on network error", async () => {
      mockFetch.mockRejectedValueOnce(new TypeError("fetch failed"));

      await expect(triggerReindex(creds)).rejects.toThrow(ServiceError);
    });
  });

  // ── akFetchAutocomplete ───────────────────────────────────────────────────

  describe("akFetchAutocomplete", () => {
    it("returns suggestions array from response", async () => {
      const suggestions = [
        { noteId: "n1", title: "Alice the Brave" },
        { noteId: "n2", title: "Aldric the Wise" },
      ];
      mockFetch.mockResolvedValueOnce(makeOkResponse({ suggestions }));

      const result = await akFetchAutocomplete(creds, "al");

      expect(result).toEqual(suggestions);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/suggest/autocomplete?q=al"),
        expect.anything(),
      );
    });

    it("returns empty array when suggestions key is absent", async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({}));

      const result = await akFetchAutocomplete(creds, "xyz");

      expect(result).toEqual([]);
    });

    it("URL-encodes the query parameter", async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({ suggestions: [] }));

      await akFetchAutocomplete(creds, "hello world & more");

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("q=hello%20world%20%26%20more");
    });

    it("throws ServiceError on 401", async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(401));

      await expect(akFetchAutocomplete(creds, "test")).rejects.toThrow(ServiceError);
    });

    it("throws ServiceError on network error", async () => {
      mockFetch.mockRejectedValueOnce(new TypeError("fetch failed"));

      await expect(akFetchAutocomplete(creds, "test")).rejects.toThrow(ServiceError);
    });
  });
});
