import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockNextRequest, setupNextServerMock } from "@/app/api/__test-helpers__/mock-next";
import { mockEtapiCreds, mockNoCreds } from "@/app/api/__test-helpers__/mock-creds";
import { POST } from "./route";

setupNextServerMock();

vi.mock("@/lib/get-creds", () => ({
  getEtapiCreds: vi.fn(),
}));

vi.mock("@/lib/article-copilot", () => ({
  applyArticleCopilotProposal: vi.fn(),
}));

import { getEtapiCreds } from "@/lib/get-creds";
import { applyArticleCopilotProposal } from "@/lib/article-copilot";

describe("/api/lore/[id]/copilot/apply", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when AllCodex credentials are missing", async () => {
    vi.mocked(getEtapiCreds).mockResolvedValue(mockNoCreds());

    const req = new MockNextRequest("http://localhost/api/lore/n1/copilot/apply", {
      method: "POST",
      body: { proposal: { targets: [] }, approvedTargetIds: [] },
    }) as any;

    const res = await POST(req, { params: Promise.resolve({ id: "n1" }) }) as any;

    expect(res.status).toBe(503);
    expect(res.body.error).toBe("NOT_CONFIGURED");
  });

  it("returns apply results from the server helper", async () => {
    vi.mocked(getEtapiCreds).mockResolvedValue(mockEtapiCreds());
    vi.mocked(applyArticleCopilotProposal).mockResolvedValue({
      updatedNoteIds: ["n1"],
      createdNoteIds: ["n2"],
      skipped: [],
    });

    const proposal = {
      targets: [
        {
          kind: "create",
          targetId: "tmp-1",
          title: "New Note",
          loreType: "character",
          contentHtml: "<p>Created</p>",
          labelUpserts: [],
          labelDeletes: [],
          relationAdds: [
            {
              relationshipType: "related_to",
              targetId: "n1",
              targetKind: "existing",
              bidirectional: true,
            },
          ],
          relationDeletes: [],
          rationale: "Needed nearby.",
        },
      ],
    };

    const req = new MockNextRequest("http://localhost/api/lore/n1/copilot/apply", {
      method: "POST",
      body: { proposal, approvedTargetIds: ["tmp-1"] },
    }) as any;

    const res = await POST(req, { params: Promise.resolve({ id: "n1" }) }) as any;

    expect(res.status).toBe(200);
    expect(applyArticleCopilotProposal).toHaveBeenCalledWith(
      mockEtapiCreds(),
      "n1",
      proposal,
      ["tmp-1"],
    );
    expect(res.body.applied.createdNoteIds).toEqual(["n2"]);
  });
});
