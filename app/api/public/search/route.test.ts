import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupNextServerMock, MockNextRequest } from "@/app/api/__test-helpers__/mock-next";
import { GET } from "./route";

setupNextServerMock();

describe("/api/public/search", () => {
  const originalAllCodexUrl = process.env.ALLCODEX_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ALLCODEX_URL = "http://localhost:8080";
  });

  afterEach(() => {
    process.env.ALLCODEX_URL = originalAllCodexUrl;
  });

  it("returns empty results when q is empty", async () => {
    const req = new MockNextRequest("http://localhost/api/public/search?q=") as any;
    const res = await GET(req) as any;

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([]);
  });

  it("performs search and proxies results from core server", async () => {
    // Mock fetch twice: first for fetchCoreShareRoot, second for search
    const fetchMock = vi.fn();
    global.fetch = fetchMock;

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({
        noteId: "root-123",
        title: "Chronicle Root",
        content: "Root Page",
      }), { status: 200, headers: { "Content-Type": "application/json" } })
    );

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({
        results: [
          { id: "note-1", title: "Blackstone Keep", score: 10, path: "Places / Ruins" }
        ]
      }), { status: 200, headers: { "Content-Type": "application/json" } })
    );

    const req = new MockNextRequest("http://localhost/api/public/search?q=Blackstone") as any;
    const res = await GET(req) as any;

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].title).toBe("Blackstone Keep");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:8080/share/");
    expect(fetchMock.mock.calls[1][0]).toContain("http://localhost:8080/share/api/notes?ancestorNoteId=root-123&search=Blackstone");
  });
});
