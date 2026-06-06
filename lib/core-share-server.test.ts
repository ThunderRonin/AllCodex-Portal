import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCoreShareNote, getCoreShareNoteAccess, normalizeCoreShareHtml } from "./core-share-server";

describe("core-share-server", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("fetches Core share notes with normalized base URLs and encoded ids", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        noteId: "note 1",
        title: "Shared",
        type: "text",
        mime: "text/html",
        content: "<p>Shared</p>",
      }), { status: 200 })
    );

    const note = await fetchCoreShareNote("http://localhost:8080///", "note 1");

    expect(global.fetch).toHaveBeenCalledWith("http://localhost:8080/share/note%201", expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(note).toMatchObject({ noteId: "note 1", title: "Shared", content: "<p>Shared</p>" });
  });

  it("distinguishes protected share notes from missing share notes", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(new Response("", { status: 404 }));

    await expect(getCoreShareNoteAccess("http://localhost:8080/", "protected")).resolves.toBe("requiresAuth");
    await expect(getCoreShareNoteAccess("http://localhost:8080/", "missing")).resolves.toBe("missing");
  });

  it("rewrites Core share links for Portal public pages", () => {
    const html = '<a href="./city">City</a><img src="/share/api/images/pic/image">';

    const result = normalizeCoreShareHtml("http://localhost:8080/", html);

    expect(result).toBe('<a href="/public/lore/city">City</a><img src="http://localhost:8080/share/api/images/pic/image">');
  });

  it("maps timed out Core share fetches to unreachable service errors", async () => {
    vi.useFakeTimers();
    global.fetch = vi.fn((_url, init) => {
      const signal = (init as RequestInit).signal as AbortSignal;
      return new Promise<Response>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
      });
    });

    const result = expect(fetchCoreShareNote("http://localhost:8080", "slow-note")).rejects.toMatchObject({
      code: "UNREACHABLE",
      httpStatus: 503,
    });
    await vi.advanceTimersByTimeAsync(8_000);
    await result;
  });
});
