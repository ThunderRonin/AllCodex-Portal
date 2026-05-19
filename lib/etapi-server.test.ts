import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ServiceError } from "./route-error";

// ── Dependency mocks (hoisted by vitest) ────────────────────────────────────

vi.mock("./lore-presentation", () => ({
  isPortraitRelationName: (name: string) =>
    ["portraitImage", "coverImage", "portrait", "heroImage"].includes(name),
}));

vi.mock("./theme-song", () => ({
  getThemeSongUrl: () => null,
}));

// ── Module under test ───────────────────────────────────────────────────────

import {
  createAttribute,
  createBranch,
  createNote,
  deleteAttribute,
  deleteBranch,
  deleteNote,
  getAppInfo,
  getBranch,
  getNote,
  getNoteAncestors,
  getNoteContent,
  getPortraitImageNoteId,
  getThemeSongUrl,
  patchBranch,
  patchNote,
  putNoteContent,
  refreshNoteOrdering,
  resolveNoteRelations,
  searchBacklinks,
  searchNotes,
  searchNotesTitles,
  type EtapiAttribute,
  type EtapiNote,
} from "./etapi-server";

// ── Helpers ─────────────────────────────────────────────────────────────────

const creds = { url: "http://allcodex.test", token: "test-token" };

const mockFetch = vi.fn<typeof fetch>();

function makeOkResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function makeTextResponse(text: string): Response {
  return new Response(text, {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}

function makeErrorResponse(status: number, body = ""): Response {
  return new Response(body, { status, headers: {} });
}

function makeAttr(overrides: Partial<EtapiAttribute> & Pick<EtapiAttribute, "name">): EtapiAttribute {
  return {
    attributeId: `attr-${overrides.name}`,
    noteId: "n1",
    type: "label",
    value: "",
    isInheritable: false,
    ...overrides,
  };
}

function makeNote(overrides: Partial<EtapiNote> & Pick<EtapiNote, "noteId" | "title">): EtapiNote {
  return {
    type: "text",
    mime: "text/html",
    isProtected: false,
    dateCreated: "2024-01-01",
    dateModified: "2024-01-01",
    utcDateModified: "2024-01-01",
    parentNoteIds: [],
    childNoteIds: [],
    parentBranchIds: [],
    childBranchIds: [],
    attributes: [],
    ...overrides,
  };
}

/** Returns the URL string from the most recent fetch call */
function lastFetchUrl(): string {
  const call = mockFetch.mock.lastCall;
  if (!call) throw new Error("fetch was not called");
  return String(call[0]);
}

/** Returns the init from the most recent fetch call */
function lastFetchInit(): RequestInit {
  const call = mockFetch.mock.lastCall;
  if (!call) throw new Error("fetch was not called");
  return (call[1] ?? {}) as RequestInit;
}

// ── Setup / Teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ── etapiFetch error paths (tested through callers) ─────────────────────────

describe("etapiFetch error paths", () => {
  it("throws UNREACHABLE (503) on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    try {
      await getNote(creds, "n1");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ServiceError);
      expect((err as ServiceError).code).toBe("UNREACHABLE");
      expect((err as ServiceError).httpStatus).toBe(503);
    }
  });

  it("throws UNAUTHORIZED (401) when ETAPI returns 401", async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(401));

    try {
      await getNote(creds, "n1");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ServiceError);
      expect((err as ServiceError).code).toBe("UNAUTHORIZED");
      expect((err as ServiceError).httpStatus).toBe(401);
    }
  });

  it("throws SERVICE_ERROR (502) on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(500, "Internal Server Error"));

    try {
      await getNote(creds, "n1");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ServiceError);
      expect((err as ServiceError).code).toBe("SERVICE_ERROR");
      expect((err as ServiceError).httpStatus).toBe(502);
    }
  });

  it("includes method and path in SERVICE_ERROR message", async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(404, "not found"));

    try {
      await deleteNote(creds, "n1");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ServiceError);
      expect((err as ServiceError).message).toContain("DELETE");
      expect((err as ServiceError).message).toContain("/notes/n1");
      expect((err as ServiceError).message).toContain("404");
    }
  });

  it("sends Authorization header with token", async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse({ appVersion: "1.0" }));

    await getAppInfo(creds);

    const headers = lastFetchInit().headers as Record<string, string>;
    expect(headers.Authorization).toBe("test-token");
  });
});

// ── searchNotes ─────────────────────────────────────────────────────────────

describe("searchNotes", () => {
  it("returns results array from response data", async () => {
    const notes = [makeNote({ noteId: "n1", title: "Foo" })];
    mockFetch.mockResolvedValueOnce(makeOkResponse({ results: notes }));

    const result = await searchNotes(creds, "#lore");

    expect(result).toEqual(notes);
    expect(lastFetchUrl()).toContain("/etapi/notes?search=%23lore&limit=200");
  });

  it("URL-encodes the query parameter (spaces become %20)", async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse({ results: [] }));

    await searchNotes(creds, "foo bar");

    expect(lastFetchUrl()).toContain("search=foo%20bar");
  });

  it("returns empty array when results is missing", async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse({}));

    const result = await searchNotes(creds, "query");

    expect(result).toEqual([]);
  });
});

// ── searchNotesTitles ───────────────────────────────────────────────────────

describe("searchNotesTitles", () => {
  it("maps results to { noteId, title, loreType }", async () => {
    const note = makeNote({
      noteId: "n1",
      title: "Dragon",
      attributes: [makeAttr({ name: "loreType", value: "creature" })],
    });
    mockFetch.mockResolvedValueOnce(makeOkResponse({ results: [note] }));

    const result = await searchNotesTitles(creds, "dragon");

    expect(result).toEqual([{ noteId: "n1", title: "Dragon", loreType: "creature" }]);
  });

  it("returns undefined loreType when attribute is absent", async () => {
    const note = makeNote({ noteId: "n2", title: "Misc", attributes: [] });
    mockFetch.mockResolvedValueOnce(makeOkResponse({ results: [note] }));

    const result = await searchNotesTitles(creds, "misc");

    expect(result[0].loreType).toBeUndefined();
  });

  it("respects custom limit parameter", async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse({ results: [] }));

    await searchNotesTitles(creds, "q", 20);

    expect(lastFetchUrl()).toContain("limit=20");
  });

  it("defaults limit to 8", async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse({ results: [] }));

    await searchNotesTitles(creds, "q");

    expect(lastFetchUrl()).toContain("limit=8");
  });
});

// ── getNote ─────────────────────────────────────────────────────────────────

describe("getNote", () => {
  it("fetches /notes/{id} and returns parsed JSON", async () => {
    const note = makeNote({ noteId: "abc", title: "Test" });
    mockFetch.mockResolvedValueOnce(makeOkResponse(note));

    const result = await getNote(creds, "abc");

    expect(result).toEqual(note);
    expect(lastFetchUrl()).toBe("http://allcodex.test/etapi/notes/abc");
  });
});

// ── getNoteContent ──────────────────────────────────────────────────────────

describe("getNoteContent", () => {
  it("fetches /notes/{id}/content and returns text", async () => {
    mockFetch.mockResolvedValueOnce(makeTextResponse("<p>Hello</p>"));

    const result = await getNoteContent(creds, "abc");

    expect(result).toBe("<p>Hello</p>");
    expect(lastFetchUrl()).toBe("http://allcodex.test/etapi/notes/abc/content");
  });
});

// ── createNote ──────────────────────────────────────────────────────────────

describe("createNote", () => {
  it("POSTs to /create-note with provided content", async () => {
    const response = { note: makeNote({ noteId: "new1", title: "New" }), branch: {} };
    mockFetch.mockResolvedValueOnce(makeOkResponse(response));

    const result = await createNote(creds, {
      parentNoteId: "root",
      title: "New",
      content: "<p>Real content</p>",
    });

    expect(result).toEqual(response);
    expect(lastFetchUrl()).toBe("http://allcodex.test/etapi/create-note");
    expect(lastFetchInit().method).toBe("POST");

    const body = JSON.parse(lastFetchInit().body as string);
    expect(body.content).toBe("<p>Real content</p>");
    expect(body.type).toBe("text");
  });

  it("defaults empty content to <p></p>", async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse({ note: makeNote({ noteId: "n", title: "T" }), branch: {} }));

    await createNote(creds, { parentNoteId: "root", title: "T", content: "" });

    const body = JSON.parse(lastFetchInit().body as string);
    expect(body.content).toBe("<p></p>");
  });

  it("defaults whitespace-only content to <p></p>", async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse({ note: makeNote({ noteId: "n", title: "T" }), branch: {} }));

    await createNote(creds, { parentNoteId: "root", title: "T", content: "   " });

    const body = JSON.parse(lastFetchInit().body as string);
    expect(body.content).toBe("<p></p>");
  });

  it("defaults missing content to <p></p>", async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse({ note: makeNote({ noteId: "n", title: "T" }), branch: {} }));

    await createNote(creds, { parentNoteId: "root", title: "T" });

    const body = JSON.parse(lastFetchInit().body as string);
    expect(body.content).toBe("<p></p>");
  });
});

// ── patchNote ───────────────────────────────────────────────────────────────

describe("patchNote", () => {
  it("PATCHes /notes/{id} with patch data", async () => {
    const patched = makeNote({ noteId: "n1", title: "Renamed" });
    mockFetch.mockResolvedValueOnce(makeOkResponse(patched));

    const result = await patchNote(creds, "n1", { title: "Renamed" });

    expect(result).toEqual(patched);
    expect(lastFetchUrl()).toBe("http://allcodex.test/etapi/notes/n1");
    expect(lastFetchInit().method).toBe("PATCH");
    expect(JSON.parse(lastFetchInit().body as string)).toEqual({ title: "Renamed" });
  });
});

// ── putNoteContent ──────────────────────────────────────────────────────────

describe("putNoteContent", () => {
  it("PUTs HTML content with text/html Content-Type", async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await putNoteContent(creds, "n1", "<p>Updated</p>");

    expect(lastFetchUrl()).toBe("http://allcodex.test/etapi/notes/n1/content");
    expect(lastFetchInit().method).toBe("PUT");
    expect(lastFetchInit().body).toBe("<p>Updated</p>");

    // Core's express.text() only parses text/plain — text/html results in null body
    const headers = lastFetchInit().headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("text/plain");
  });
});

// ── deleteNote ──────────────────────────────────────────────────────────────

describe("deleteNote", () => {
  it("DELETEs /notes/{id}", async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await deleteNote(creds, "n1");

    expect(lastFetchUrl()).toBe("http://allcodex.test/etapi/notes/n1");
    expect(lastFetchInit().method).toBe("DELETE");
  });
});

// ── createAttribute ─────────────────────────────────────────────────────────

describe("createAttribute", () => {
  it("POSTs to /attributes with params", async () => {
    const attr = makeAttr({ name: "loreType", value: "character", noteId: "n1" });
    mockFetch.mockResolvedValueOnce(makeOkResponse(attr));

    const result = await createAttribute(creds, {
      noteId: "n1",
      type: "label",
      name: "loreType",
      value: "character",
    });

    expect(result).toEqual(attr);
    expect(lastFetchUrl()).toBe("http://allcodex.test/etapi/attributes");
    expect(lastFetchInit().method).toBe("POST");
  });
});

// ── deleteAttribute ─────────────────────────────────────────────────────────

describe("deleteAttribute", () => {
  it("DELETEs /attributes/{id}", async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await deleteAttribute(creds, "attr-1");

    expect(lastFetchUrl()).toBe("http://allcodex.test/etapi/attributes/attr-1");
    expect(lastFetchInit().method).toBe("DELETE");
  });
});

// ── Branch operations ───────────────────────────────────────────────────────

describe("createBranch", () => {
  it("POSTs to /branches", async () => {
    const branch = { branchId: "b1", noteId: "n1", parentNoteId: "p1" };
    mockFetch.mockResolvedValueOnce(makeOkResponse(branch));

    const result = await createBranch(creds, { noteId: "n1", parentNoteId: "p1" });

    expect(result).toEqual(branch);
    expect(lastFetchUrl()).toBe("http://allcodex.test/etapi/branches");
    expect(lastFetchInit().method).toBe("POST");
  });
});

describe("getBranch", () => {
  it("GETs /branches/{id}", async () => {
    const branch = { branchId: "b1" };
    mockFetch.mockResolvedValueOnce(makeOkResponse(branch));

    const result = await getBranch(creds, "b1");

    expect(result).toEqual(branch);
    expect(lastFetchUrl()).toBe("http://allcodex.test/etapi/branches/b1");
  });
});

describe("deleteBranch", () => {
  it("DELETEs /branches/{id}", async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await deleteBranch(creds, "b1");

    expect(lastFetchUrl()).toBe("http://allcodex.test/etapi/branches/b1");
    expect(lastFetchInit().method).toBe("DELETE");
  });
});

describe("patchBranch", () => {
  it("PATCHes /branches/{id}", async () => {
    const branch = { branchId: "b1", notePosition: 10 };
    mockFetch.mockResolvedValueOnce(makeOkResponse(branch));

    const result = await patchBranch(creds, "b1", { notePosition: 10 });

    expect(result).toEqual(branch);
    expect(lastFetchUrl()).toBe("http://allcodex.test/etapi/branches/b1");
    expect(lastFetchInit().method).toBe("PATCH");
  });
});

describe("refreshNoteOrdering", () => {
  it("POSTs to /refresh-note-ordering/{id}", async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await refreshNoteOrdering(creds, "parent1");

    expect(lastFetchUrl()).toBe("http://allcodex.test/etapi/refresh-note-ordering/parent1");
    expect(lastFetchInit().method).toBe("POST");
  });
});

// ── getNoteAncestors ────────────────────────────────────────────────────────

describe("getNoteAncestors", () => {
  it("walks parent chain and returns ancestors root-first", async () => {
    // Chain: n3 -> n2 -> n1 -> root
    const n3 = makeNote({ noteId: "n3", title: "Leaf", parentNoteIds: ["n2"] });
    const n2 = makeNote({ noteId: "n2", title: "Middle", parentNoteIds: ["n1"] });
    const n1 = makeNote({ noteId: "n1", title: "Top", parentNoteIds: ["root"] });

    // Call sequence: getNote(n3), getNote(n2), getNote(n2), getNote(n1), getNote(n1), getNote(root→stop)
    // Actually let's trace: getNoteAncestors("n3") starts with currentId="n3"
    // i=0: getNote("n3") -> parentId="n2", not root, not visited -> getNote("n2") -> unshift(n2, "Middle"), currentId="n2"
    // i=1: getNote("n2") -> parentId="n1", not root, not visited -> getNote("n1") -> unshift(n1, "Top"), currentId="n1"
    // i=2: getNote("n1") -> parentId="root" -> break
    mockFetch
      .mockResolvedValueOnce(makeOkResponse(n3))  // getNote("n3")
      .mockResolvedValueOnce(makeOkResponse(n2))  // getNote("n2") - parent fetch
      .mockResolvedValueOnce(makeOkResponse(n2))  // getNote("n2") - next iteration
      .mockResolvedValueOnce(makeOkResponse(n1))  // getNote("n1") - parent fetch
      .mockResolvedValueOnce(makeOkResponse(n1)); // getNote("n1") - next iteration -> parentId=root -> break

    const result = await getNoteAncestors(creds, "n3");

    expect(result).toEqual([
      { noteId: "n1", title: "Top" },
      { noteId: "n2", title: "Middle" },
    ]);
  });

  it("stops at root parent", async () => {
    const note = makeNote({ noteId: "n1", title: "Only", parentNoteIds: ["root"] });
    mockFetch.mockResolvedValueOnce(makeOkResponse(note));

    const result = await getNoteAncestors(creds, "n1");

    expect(result).toEqual([]);
  });

  it("stops at cycle (visited parent)", async () => {
    // n1 -> n2 -> n1 (cycle)
    const n1 = makeNote({ noteId: "n1", title: "A", parentNoteIds: ["n2"] });
    const n2 = makeNote({ noteId: "n2", title: "B", parentNoteIds: ["n1"] });

    mockFetch
      .mockResolvedValueOnce(makeOkResponse(n1))  // getNote("n1") -> parentId="n2"
      .mockResolvedValueOnce(makeOkResponse(n2))  // getNote("n2") - fetch parent
      .mockResolvedValueOnce(makeOkResponse(n2)); // getNote("n2") -> parentId="n1" which is visited -> break

    const result = await getNoteAncestors(creds, "n1");

    expect(result).toEqual([{ noteId: "n2", title: "B" }]);
  });

  it("stops at maxDepth", async () => {
    // Use maxDepth=1, so only one iteration
    const n1 = makeNote({ noteId: "n1", title: "Start", parentNoteIds: ["n2"] });
    const n2 = makeNote({ noteId: "n2", title: "Parent", parentNoteIds: ["n3"] });

    mockFetch
      .mockResolvedValueOnce(makeOkResponse(n1))
      .mockResolvedValueOnce(makeOkResponse(n2));

    const result = await getNoteAncestors(creds, "n1", 1);

    expect(result).toEqual([{ noteId: "n2", title: "Parent" }]);
  });

  it("handles fetch error gracefully and returns partial result", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network error"));

    const result = await getNoteAncestors(creds, "n1");

    // getNote("n1") fails -> catch returns null -> break -> empty
    expect(result).toEqual([]);
  });

  it("handles parent fetch error gracefully", async () => {
    const n1 = makeNote({ noteId: "n1", title: "Start", parentNoteIds: ["n2"] });
    mockFetch
      .mockResolvedValueOnce(makeOkResponse(n1))   // getNote("n1") ok
      .mockRejectedValueOnce(new Error("fail"));    // getNote("n2") fails

    const result = await getNoteAncestors(creds, "n1");

    expect(result).toEqual([]);
  });

  it("stops when note has no parentNoteIds", async () => {
    const note = makeNote({ noteId: "n1", title: "Orphan", parentNoteIds: [] });
    mockFetch.mockResolvedValueOnce(makeOkResponse(note));

    const result = await getNoteAncestors(creds, "n1");

    expect(result).toEqual([]);
  });
});

// ── searchBacklinks ─────────────────────────────────────────────────────────

describe("searchBacklinks", () => {
  it("filters out non-lore and self results", async () => {
    mockFetch.mockResolvedValueOnce(
      makeOkResponse({
        results: [
          makeNote({
            noteId: "note-current",
            title: "Current",
            attributes: [makeAttr({ name: "lore" })],
          }),
          makeNote({
            noteId: "note-lore",
            title: "Aether Keep",
            attributes: [
              makeAttr({ name: "lore" }),
              makeAttr({ name: "loreType", value: "location" }),
            ],
          }),
          makeNote({
            noteId: "note-system",
            title: "System",
            attributes: [],
          }),
        ],
      }),
    );

    const result = await searchBacklinks(creds, "note-current");

    expect(result).toEqual([{ noteId: "note-lore", title: "Aether Keep", loreType: "location" }]);
  });

  it("returns empty array on fetch error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network error"));

    const result = await searchBacklinks(creds, "n1");

    expect(result).toEqual([]);
  });

  it("returns null loreType when attribute is absent", async () => {
    mockFetch.mockResolvedValueOnce(
      makeOkResponse({
        results: [
          makeNote({
            noteId: "n2",
            title: "Linked",
            attributes: [makeAttr({ name: "lore" })],
          }),
        ],
      }),
    );

    const result = await searchBacklinks(creds, "n1");

    expect(result).toEqual([{ noteId: "n2", title: "Linked", loreType: null }]);
  });
});

// ── getPortraitImageNoteId ──────────────────────────────────────────────────

describe("getPortraitImageNoteId", () => {
  it("returns noteId from portrait relation", async () => {
    const note = makeNote({
      noteId: "n1",
      title: "Hero",
      attributes: [
        makeAttr({ name: "portraitImage", type: "relation", value: "img-123" }),
      ],
    });

    expect(getPortraitImageNoteId(note)).toBe("img-123");
  });

  it("recognizes all portrait relation names", () => {
    for (const name of ["portraitImage", "coverImage", "portrait", "heroImage"]) {
      const note = makeNote({
        noteId: "n1",
        title: "Hero",
        attributes: [makeAttr({ name, type: "relation", value: "img-1" })],
      });
      expect(getPortraitImageNoteId(note)).toBe("img-1");
    }
  });

  it("returns null when no portrait relation exists", () => {
    const note = makeNote({
      noteId: "n1",
      title: "No Portrait",
      attributes: [makeAttr({ name: "loreType", value: "character" })],
    });

    expect(getPortraitImageNoteId(note)).toBeNull();
  });

  it("ignores label-type attributes even with portrait name", () => {
    const note = makeNote({
      noteId: "n1",
      title: "Tricky",
      attributes: [
        // type defaults to "label" in makeAttr — should be skipped
        makeAttr({ name: "portraitImage", type: "label", value: "img-1" }),
      ],
    });

    expect(getPortraitImageNoteId(note)).toBeNull();
  });
});

// ── getThemeSongUrl ─────────────────────────────────────────────────────────

describe("getThemeSongUrl", () => {
  it("delegates to theme-song module and returns its result", () => {
    const note = makeNote({ noteId: "n1", title: "T" });
    // Our mock always returns null
    expect(getThemeSongUrl(note)).toBeNull();
  });
});

// ── resolveNoteRelations ────────────────────────────────────────────────────

describe("resolveNoteRelations", () => {
  it("filters out template and portrait relations, resolves targets", async () => {
    const note = makeNote({
      noteId: "n1",
      title: "Dragon",
      attributes: [
        makeAttr({ name: "template", type: "relation", value: "tpl-1" }),
        makeAttr({ name: "portraitImage", type: "relation", value: "img-1" }),
        makeAttr({ name: "relEnemy", type: "relation", value: "n2" }),
        makeAttr({ name: "relAlly", type: "relation", value: "n3" }),
      ],
    });

    const target1 = makeNote({
      noteId: "n2",
      title: "Knight",
      attributes: [makeAttr({ name: "loreType", value: "character" })],
    });
    const target2 = makeNote({
      noteId: "n3",
      title: "Elf",
      attributes: [],
    });

    mockFetch
      .mockResolvedValueOnce(makeOkResponse(target1))
      .mockResolvedValueOnce(makeOkResponse(target2));

    const result = await resolveNoteRelations(creds, note);

    expect(result).toEqual([
      { name: "relEnemy", targetNoteId: "n2", targetTitle: "Knight", loreType: "character" },
      { name: "relAlly", targetNoteId: "n3", targetTitle: "Elf", loreType: null },
    ]);
  });

  it("uses relation value as fallback title when target fetch fails", async () => {
    const note = makeNote({
      noteId: "n1",
      title: "Source",
      attributes: [
        makeAttr({ name: "relBoss", type: "relation", value: "missing-id" }),
      ],
    });

    mockFetch.mockRejectedValueOnce(new Error("not found"));

    const result = await resolveNoteRelations(creds, note);

    expect(result).toEqual([
      { name: "relBoss", targetNoteId: "missing-id", targetTitle: "missing-id", loreType: null },
    ]);
  });

  it("returns empty array when note has no relation attributes", async () => {
    const note = makeNote({
      noteId: "n1",
      title: "Lonely",
      attributes: [makeAttr({ name: "loreType", value: "location" })],
    });

    const result = await resolveNoteRelations(creds, note);

    expect(result).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("filters all portrait relation names", async () => {
    const note = makeNote({
      noteId: "n1",
      title: "X",
      attributes: [
        makeAttr({ name: "coverImage", type: "relation", value: "img-1" }),
        makeAttr({ name: "heroImage", type: "relation", value: "img-2" }),
        makeAttr({ name: "portrait", type: "relation", value: "img-3" }),
      ],
    });

    const result = await resolveNoteRelations(creds, note);

    expect(result).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ── getAppInfo ──────────────────────────────────────────────────────────────

describe("getAppInfo", () => {
  it("GETs /app-info and returns parsed JSON", async () => {
    const info = {
      appVersion: "0.63.7",
      dbVersion: 228,
      syncVersion: 32,
      buildDate: "2024-01-01",
      buildRevision: "abc123",
      dataDirectory: "/data",
      clipperProtocolVersion: "1.0",
    };
    mockFetch.mockResolvedValueOnce(makeOkResponse(info));

    const result = await getAppInfo(creds);

    expect(result).toEqual(info);
    expect(lastFetchUrl()).toBe("http://allcodex.test/etapi/app-info");
  });
});
