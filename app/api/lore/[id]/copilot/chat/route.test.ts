import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockNextRequest, setupNextServerMock } from "@/app/api/__test-helpers__/mock-next";
import { mockAkCreds, mockEtapiCreds, mockNoCreds } from "@/app/api/__test-helpers__/mock-creds";
import { POST } from "./route";

setupNextServerMock();

vi.mock("@/lib/get-creds", () => ({
  getEtapiCreds: vi.fn(),
  getAkCreds: vi.fn(),
}));

vi.mock("@/lib/etapi-server", () => ({
  getNote: vi.fn(),
  getNoteContent: vi.fn(),
  searchBacklinks: vi.fn(),
}));

vi.mock("@/lib/article-copilot", () => ({
  loadArticleCopilotContext: vi.fn(),
  trimCopilotTranscript: vi.fn((messages) => messages),
}));

vi.mock("@/lib/allknower-server", () => ({
  runArticleCopilot: vi.fn(),
}));

import { getAkCreds, getEtapiCreds } from "@/lib/get-creds";
import { loadArticleCopilotContext } from "@/lib/article-copilot";
import { runArticleCopilot } from "@/lib/allknower-server";

describe("/api/lore/[id]/copilot/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds writable context separately from rag-only context", async () => {
    vi.mocked(getEtapiCreds).mockResolvedValue(mockEtapiCreds());
    vi.mocked(getAkCreds).mockResolvedValue(mockAkCreds());
    vi.mocked(loadArticleCopilotContext).mockResolvedValue({
      currentNote: {
        noteId: "note-current",
        title: "Current Note",
        loreType: "location",
        contentHtml: "<p>Current</p>",
        parentNoteIds: ["parent-1"],
        labels: [],
        relations: [],
      },
      linkedNotes: [
        {
          noteId: "note-linked",
          title: "Linked Note",
          loreType: "character",
          contentHtml: "<p>Linked</p>",
          parentNoteIds: ["parent-1"],
          labels: [],
          relations: [],
        },
      ],
      ragContext: [
        {
          noteId: "note-rag",
          title: "RAG Note",
          excerpt: "Read-only grounding",
          score: 0.91,
        },
      ],
      writableTargetIds: ["note-current", "note-linked"],
    });
    vi.mocked(runArticleCopilot).mockResolvedValue({
      assistantMessage: "Drafted a proposal.",
      citations: [{ noteId: "note-rag", title: "RAG Note", source: "rag" }],
      proposal: null,
    });

    const req = new MockNextRequest("http://localhost/api/lore/note-current/copilot/chat", {
      method: "POST",
      body: {
        messages: [{ role: "user", content: "Expand the city guard." }],
      },
    }) as any;

    const res = await POST(req, { params: Promise.resolve({ id: "note-current" }) }) as any;

    expect(res.status).toBe(200);
    expect(runArticleCopilot).toHaveBeenCalledWith(
      mockAkCreds(),
      expect.objectContaining({
        noteId: "note-current",
        writableTargetIds: ["note-current", "note-linked"],
        ragContext: [
          {
            noteId: "note-rag",
            title: "RAG Note",
            excerpt: "Read-only grounding",
            score: 0.91,
          },
        ],
      }),
    );
  });

  it("returns not configured when AllKnower credentials are missing", async () => {
    vi.mocked(getEtapiCreds).mockResolvedValue(mockEtapiCreds());
    vi.mocked(getAkCreds).mockResolvedValue(mockNoCreds());

    const req = new MockNextRequest("http://localhost/api/lore/note-current/copilot/chat", {
      method: "POST",
      body: { messages: [{ role: "user", content: "Hello" }] },
    }) as any;

    const res = await POST(req, { params: Promise.resolve({ id: "note-current" }) }) as any;

    expect(res.status).toBe(503);
    expect(res.body.error).toBe("NOT_CONFIGURED");
  });
});
