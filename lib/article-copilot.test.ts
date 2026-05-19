import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyArticleCopilotProposal,
  loadArticleCopilotContext,
  trimCopilotTranscript,
} from "./article-copilot";
import type { EtapiNote } from "./etapi-server";

vi.mock("./etapi-server", () => ({
  createAttribute: vi.fn(),
  createNote: vi.fn(),
  deleteAttribute: vi.fn(),
  getNote: vi.fn(),
  getNoteContent: vi.fn(),
  patchNote: vi.fn(),
  putNoteContent: vi.fn(),
  searchBacklinks: vi.fn(),
}));

vi.mock("./allknower-server", () => ({
  queryRag: vi.fn(),
}));

import {
  createAttribute,
  createNote,
  getNote,
  getNoteContent,
  putNoteContent,
  searchBacklinks,
} from "./etapi-server";
import { queryRag } from "./allknower-server";

const creds = { url: "http://allcodex.test", token: "etapi-token" };
const akCreds = { url: "http://allknower.test", token: "ak-token" };

function note(overrides: Partial<EtapiNote>): EtapiNote {
  return {
    noteId: "note-current",
    title: "Current",
    type: "text",
    mime: "text/html",
    isProtected: false,
    dateCreated: "2026-01-01",
    dateModified: "2026-01-01",
    utcDateModified: "2026-01-01",
    parentNoteIds: ["parent-1"],
    childNoteIds: [],
    parentBranchIds: [],
    childBranchIds: [],
    attributes: [],
    ...overrides,
  };
}

describe("article copilot Portal helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getNoteContent).mockResolvedValue("<p>content</p>");
    vi.mocked(searchBacklinks).mockResolvedValue([]);
    vi.mocked(queryRag).mockResolvedValue([]);
  });

  it("does not mark portraitImage relation targets as writable linked notes", async () => {
    vi.mocked(getNote).mockImplementation(async (_creds, noteId) => {
      if (noteId === "note-current") {
        return note({
          noteId,
          attributes: [
            {
              attributeId: "attr-portrait",
              noteId,
              type: "relation",
              name: "portraitImage",
              value: "image-note",
              isInheritable: false,
            },
            {
              attributeId: "attr-lore-type",
              noteId,
              type: "label",
              name: "loreType",
              value: "character",
              isInheritable: false,
            },
          ],
        });
      }
      return note({ noteId, title: "Unexpected" });
    });

    const context = await loadArticleCopilotContext(creds, akCreds, "note-current", "latest turn");

    expect(context.writableTargetIds).toEqual(["note-current"]);
    expect(context.linkedNotes).toEqual([]);
    expect(getNote).not.toHaveBeenCalledWith(creds, "image-note");
  });

  it("rejects relation adds to existing notes outside the writable set before mutation", async () => {
    vi.mocked(getNote).mockResolvedValue(note({ noteId: "note-current" }));

    const proposal = {
      targets: [
        {
          kind: "update",
          targetId: "note-current",
          labelUpserts: [],
          labelDeletes: [],
          relationAdds: [
            {
              relationshipType: "related_to",
              targetId: "out-of-scope",
              targetKind: "existing",
              bidirectional: true,
            },
          ],
          relationDeletes: [],
          rationale: "Should be rejected.",
        },
      ],
    };

    await expect(
      applyArticleCopilotProposal(creds, "note-current", proposal, ["note-current"]),
    ).rejects.toThrow("outside the writable scope");

    expect(createAttribute).not.toHaveBeenCalled();
    expect(putNoteContent).not.toHaveBeenCalled();
  });

  it("rejects immutable label operations before mutation", async () => {
    vi.mocked(getNote).mockResolvedValue(note({ noteId: "note-current" }));

    const proposal = {
      targets: [
        {
          kind: "update",
          targetId: "note-current",
          labelUpserts: [{ name: "loreType", value: "deity" }],
          labelDeletes: [],
          relationAdds: [],
          relationDeletes: [],
          rationale: "System field edit.",
        },
      ],
    };

    await expect(
      applyArticleCopilotProposal(creds, "note-current", proposal, ["note-current"]),
    ).rejects.toThrow("immutable");

    expect(createAttribute).not.toHaveBeenCalled();
    expect(putNoteContent).not.toHaveBeenCalled();
  });

  it("creates a new linked note under the current note primary parent after validation", async () => {
    vi.mocked(getNote).mockImplementation(async (_creds, noteId) => {
      if (noteId === "created-note") return note({ noteId, title: "Created" });
      return note({ noteId: "note-current", title: "Current", parentNoteIds: ["parent-1"] });
    });
    vi.mocked(createNote).mockResolvedValue({
      note: note({ noteId: "created-note", title: "New Neighbor" }),
      branch: {},
    });

    const proposal = {
      targets: [
        {
          kind: "create",
          targetId: "tmp-1",
          title: "New Neighbor",
          loreType: "character",
          contentHtml: "<p>Created body</p>",
          labelUpserts: [],
          labelDeletes: [],
          relationAdds: [
            {
              relationshipType: "related_to",
              targetId: "note-current",
              targetKind: "existing",
              bidirectional: true,
            },
          ],
          relationDeletes: [],
          rationale: "Needed nearby.",
        },
      ],
    };

    const result = await applyArticleCopilotProposal(creds, "note-current", proposal, ["tmp-1"]);

    expect(createNote).toHaveBeenCalledWith(creds, {
      parentNoteId: "parent-1",
      title: "New Neighbor",
      content: "",
    });
    expect(createAttribute).toHaveBeenCalledWith(creds, {
      noteId: "created-note",
      type: "label",
      name: "lore",
      value: "",
    });
    expect(createAttribute).toHaveBeenCalledWith(creds, {
      noteId: "created-note",
      type: "label",
      name: "loreType",
      value: "character",
    });
    expect(putNoteContent).toHaveBeenCalledWith(creds, "created-note", "<p>Created body</p>");
    expect(result.createdNoteIds).toEqual(["created-note"]);
  });

  it("returns empty result when no targets are approved", async () => {
    vi.mocked(getNote).mockResolvedValue(note({ noteId: "note-current" }));

    const proposal = {
      targets: [
        {
          kind: "update",
          targetId: "note-current",
          labelUpserts: [],
          labelDeletes: [],
          relationAdds: [],
          relationDeletes: [],
          rationale: "Should be filtered.",
        },
      ],
    };

    const result = await applyArticleCopilotProposal(creds, "note-current", proposal, []);

    expect(result).toEqual({ updatedNoteIds: [], createdNoteIds: [], skipped: [] });
    expect(putNoteContent).not.toHaveBeenCalled();
  });

  it("rejects approved IDs not in proposal targets", async () => {
    vi.mocked(getNote).mockResolvedValue(note({ noteId: "note-current" }));

    const proposal = { targets: [] };

    await expect(
      applyArticleCopilotProposal(creds, "note-current", proposal, ["ghost-id"]),
    ).rejects.toThrow("not present in the proposal");
  });

  it("updates note title when proposal specifies a different title", async () => {
    const { patchNote } = await import("./etapi-server");
    vi.mocked(patchNote).mockResolvedValue(note({ noteId: "note-current", title: "New Title" }));
    vi.mocked(getNote).mockResolvedValue(
      note({ noteId: "note-current", title: "Old Title" }),
    );

    const proposal = {
      targets: [
        {
          kind: "update",
          targetId: "note-current",
          title: "New Title",
          labelUpserts: [],
          labelDeletes: [],
          relationAdds: [],
          relationDeletes: [],
          rationale: "Rename.",
        },
      ],
    };

    const result = await applyArticleCopilotProposal(creds, "note-current", proposal, ["note-current"]);

    expect(patchNote).toHaveBeenCalledWith(creds, "note-current", { title: "New Title" });
    expect(result.updatedNoteIds).toContain("note-current");
  });

  it("rejects immutable label in labelDeletes", async () => {
    vi.mocked(getNote).mockResolvedValue(note({ noteId: "note-current" }));

    const proposal = {
      targets: [
        {
          kind: "update",
          targetId: "note-current",
          labelUpserts: [],
          labelDeletes: ["template"],
          relationAdds: [],
          relationDeletes: [],
          rationale: "Delete system label.",
        },
      ],
    };

    await expect(
      applyArticleCopilotProposal(creds, "note-current", proposal, ["note-current"]),
    ).rejects.toThrow("immutable");
  });

  it("rejects share-prefixed label as immutable", async () => {
    vi.mocked(getNote).mockResolvedValue(note({ noteId: "note-current" }));

    const proposal = {
      targets: [
        {
          kind: "update",
          targetId: "note-current",
          labelUpserts: [{ name: "shareAlias", value: "evil" }],
          labelDeletes: [],
          relationAdds: [],
          relationDeletes: [],
          rationale: "Edit share label.",
        },
      ],
    };

    await expect(
      applyArticleCopilotProposal(creds, "note-current", proposal, ["note-current"]),
    ).rejects.toThrow("immutable");
  });

  it("includes backlinks as writable when they have safe reverse relations", async () => {
    vi.mocked(getNote).mockImplementation(async (_creds, noteId) => {
      if (noteId === "backlinker") {
        return note({
          noteId: "backlinker",
          title: "Backlinker",
          attributes: [
            { attributeId: "a1", noteId: "backlinker", type: "relation", name: "ally", value: "note-current", isInheritable: false },
            { attributeId: "a2", noteId: "backlinker", type: "label", name: "lore", value: "", isInheritable: false },
          ],
        });
      }
      return note({ noteId: "note-current" });
    });
    vi.mocked(searchBacklinks).mockResolvedValue([
      { noteId: "backlinker", title: "Backlinker", loreType: "character" },
    ]);

    const context = await loadArticleCopilotContext(creds, akCreds, "note-current", "test");

    expect(context.writableTargetIds).toContain("backlinker");
  });

  it("filters RAG results that overlap writable notes", async () => {
    vi.mocked(getNote).mockResolvedValue(note({ noteId: "note-current" }));
    vi.mocked(queryRag).mockResolvedValue([
      { noteId: "note-current", noteTitle: "Current", content: "dup", score: 0.9 },
      { noteId: "rag-note", noteTitle: "External", content: "new info", score: 0.8 },
    ]);

    const context = await loadArticleCopilotContext(creds, akCreds, "note-current", "find something");

    expect(context.ragContext).toHaveLength(1);
    expect(context.ragContext[0].noteId).toBe("rag-note");
  });

  it("skips RAG when user message is blank", async () => {
    vi.mocked(getNote).mockResolvedValue(note({ noteId: "note-current" }));

    const context = await loadArticleCopilotContext(creds, akCreds, "note-current", "  ");

    expect(queryRag).not.toHaveBeenCalled();
    expect(context.ragContext).toEqual([]);
  });
});

describe("trimCopilotTranscript", () => {
  it("returns empty array for empty input", () => {
    expect(trimCopilotTranscript([])).toEqual([]);
  });

  it("passes through messages under both limits", () => {
    const messages = [
      { role: "user" as const, content: "Hello" },
      { role: "assistant" as const, content: "Hi there" },
    ];
    expect(trimCopilotTranscript(messages)).toEqual(messages);
  });

  it("keeps only the last 12 messages", () => {
    const messages = Array.from({ length: 20 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `msg-${i}`,
    }));

    const result = trimCopilotTranscript(messages);

    expect(result.length).toBe(12);
    expect(result[0].content).toBe("msg-8");
    expect(result[11].content).toBe("msg-19");
  });

  it("truncates by character budget, keeping most recent messages", () => {
    const long = "x".repeat(30_000);
    const messages = [
      { role: "user" as const, content: long },
      { role: "assistant" as const, content: "short reply" },
      { role: "user" as const, content: "follow up" },
    ];

    const result = trimCopilotTranscript(messages);

    expect(result.length).toBe(2);
    expect(result[0].content).toBe("short reply");
    expect(result[1].content).toBe("follow up");
  });

  it("truncates a single oversized message to fit budget", () => {
    const huge = "a".repeat(50_000);
    const messages = [{ role: "user" as const, content: huge }];

    const result = trimCopilotTranscript(messages);

    expect(result.length).toBe(1);
    expect(result[0].content.length).toBe(30_000);
    expect(result[0].content).toBe(huge.slice(20_000));
  });
});
