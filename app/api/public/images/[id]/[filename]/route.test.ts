import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/get-creds", () => ({
  getPublicEtapiCreds: vi.fn(),
}));

vi.mock("@/lib/core-share-server", () => ({
  getCoreShareNoteAccess: vi.fn(),
}));

import { setupNextServerMock, MockNextRequest } from "@/app/api/__test-helpers__/mock-next";
import { GET } from "./route";

setupNextServerMock();

import { getPublicEtapiCreds } from "@/lib/get-creds";
import { getCoreShareNoteAccess } from "@/lib/core-share-server";

describe("/api/public/images/[id]/[filename]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("proxies the image successfully when it is public/readable", async () => {
    vi.mocked(getPublicEtapiCreds).mockResolvedValue({
      url: "http://localhost:8080",
      token: "mock-token",
    });
    vi.mocked(getCoreShareNoteAccess).mockResolvedValue("readable");

    const mockBody = "image-bytes";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: vi.fn().mockReturnValue("image/jpeg"),
      },
      body: mockBody,
    });

    const req = new MockNextRequest("http://localhost/api/public/images/img1/pic.jpg") as any;
    const params = Promise.resolve({ id: "img1", filename: "pic.jpg" });

    const res = await GET(req, { params }) as any;

    expect(res.status).toBe(200);
    expect(await new Response(res.body).text()).toBe(mockBody);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=86400");
    expect(getCoreShareNoteAccess).toHaveBeenCalledWith("http://localhost:8080", "img1");
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:8080/share/api/images/img1/pic.jpg"
    );
  });

  it("returns 401 when getCoreShareNoteAccess returns requiresAuth", async () => {
    vi.mocked(getPublicEtapiCreds).mockResolvedValue({
      url: "http://localhost:8080",
      token: "mock-token",
    });
    vi.mocked(getCoreShareNoteAccess).mockResolvedValue("requiresAuth");

    const req = new MockNextRequest("http://localhost/api/public/images/img1/pic.jpg") as any;
    const params = Promise.resolve({ id: "img1", filename: "pic.jpg" });

    const res = await GET(req, { params }) as any;

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("UNAUTHORIZED");
  });

  it("returns 404 when getCoreShareNoteAccess returns missing", async () => {
    vi.mocked(getPublicEtapiCreds).mockResolvedValue({
      url: "http://localhost:8080",
      token: "mock-token",
    });
    vi.mocked(getCoreShareNoteAccess).mockResolvedValue("missing");

    const req = new MockNextRequest("http://localhost/api/public/images/img1/pic.jpg") as any;
    const params = Promise.resolve({ id: "img1", filename: "pic.jpg" });

    const res = await GET(req, { params }) as any;

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("NOT_FOUND");
  });

  it("returns 404 when upstream fetch returns 404", async () => {
    vi.mocked(getPublicEtapiCreds).mockResolvedValue({
      url: "http://localhost:8080",
      token: "mock-token",
    });
    vi.mocked(getCoreShareNoteAccess).mockResolvedValue("readable");

    global.fetch = vi.fn().mockResolvedValue(
      new Response("Not Found", { status: 404 })
    );

    const req = new MockNextRequest("http://localhost/api/public/images/img1/pic.jpg") as any;
    const params = Promise.resolve({ id: "img1", filename: "pic.jpg" });

    const res = await GET(req, { params }) as any;

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("NOT_FOUND");
  });

  it("returns 502 when upstream fetch fails with other status", async () => {
    vi.mocked(getPublicEtapiCreds).mockResolvedValue({
      url: "http://localhost:8080",
      token: "mock-token",
    });
    vi.mocked(getCoreShareNoteAccess).mockResolvedValue("readable");

    global.fetch = vi.fn().mockResolvedValue(
      new Response("Internal Server Error", { status: 500 })
    );

    const req = new MockNextRequest("http://localhost/api/public/images/img1/pic.jpg") as any;
    const params = Promise.resolve({ id: "img1", filename: "pic.jpg" });

    const res = await GET(req, { params }) as any;

    expect(res.status).toBe(502);
    expect(res.body.error).toBe("SERVICE_ERROR");
  });
});
