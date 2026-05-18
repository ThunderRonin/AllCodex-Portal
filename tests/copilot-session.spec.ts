import { test, expect } from "@playwright/test";
import { buildNote, installPortalApiMocks } from "./helpers/mock-api";
import { attachConsoleErrorCollector, expectNoConsoleErrors } from "./helpers/test-utils";

test.describe("Copilot Session ID Flow", () => {
  test("first message receives sessionId from AllKnower", async ({ page }) => {
    const errors = attachConsoleErrorCollector(page);
    await installPortalApiMocks(page, {
      notes: [
        buildNote({
          noteId: "note-1",
          title: "Aria Vale",
          content: "<p>Original content</p>",
        }),
      ],
    });

    await page.route("**/api/lore/note-1/copilot/stream", async (route) => {
      const result = {
        sessionId: "sess-abc123",
        assistantMessage: "Here is my response.",
        citations: [],
        proposal: null,
      };
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: [
          `event: token\ndata: ${JSON.stringify({ content: "Thinking..." })}\n\n`,
          `event: result\ndata: ${JSON.stringify(result)}\n\n`,
        ].join(""),
      });
    });

    await page.goto("/lore/note-1");
    await page.getByRole("button", { name: /lore copilot/i }).click();
    await expect(page.getByRole("heading", { name: "Article-Scoped Copilot" })).toBeVisible();

    await page.getByPlaceholder(/Ask for article edits/i).fill("Make her sound more epic");
    await page.getByRole("button", { name: /^Send$/i }).click();

    await expect(page.getByText("Here is my response.")).toBeVisible();

    await expectNoConsoleErrors(errors);
  });

  test("second message includes sessionId from first response", async ({ page }) => {
    const errors = attachConsoleErrorCollector(page);
    await installPortalApiMocks(page, {
      notes: [
        buildNote({
          noteId: "note-1",
          title: "Aria Vale",
          content: "<p>Original content</p>",
        }),
      ],
    });

    const capturedBodies: any[] = [];
    let callCount = 0;

    await page.route("**/api/lore/note-1/copilot/stream", async (route) => {
      const body = route.request().postDataJSON();
      capturedBodies.push(body);
      callCount++;

      const result = {
        sessionId: "sess-abc123",
        assistantMessage: callCount === 1 ? "First response." : "Second response.",
        citations: [],
        proposal: null,
      };
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: [
          `event: token\ndata: ${JSON.stringify({ content: "Thinking..." })}\n\n`,
          `event: result\ndata: ${JSON.stringify(result)}\n\n`,
        ].join(""),
      });
    });

    await page.goto("/lore/note-1");
    await page.getByRole("button", { name: /lore copilot/i }).click();

    // First message — should NOT include sessionId
    await page.getByPlaceholder(/Ask for article edits/i).fill("Make her sound more epic");
    await page.getByRole("button", { name: /^Send$/i }).click();
    await expect(page.getByText("First response.")).toBeVisible();

    // Verify first request body has no sessionId
    expect(capturedBodies).toHaveLength(1);
    expect(capturedBodies[0].sessionId).toBeUndefined();

    // Second message — should include sessionId from first response
    await page.getByPlaceholder(/Ask for article edits/i).fill("Now add more detail");
    await page.getByRole("button", { name: /^Send$/i }).click();
    await expect(page.getByText("Second response.")).toBeVisible();

    // Verify second request body includes sessionId
    expect(capturedBodies).toHaveLength(2);
    expect(capturedBodies[1].sessionId).toBe("sess-abc123");

    await expectNoConsoleErrors(errors);
  });

  test("clearing conversation resets sessionId", async ({ page }) => {
    const errors = attachConsoleErrorCollector(page);
    await installPortalApiMocks(page, {
      notes: [
        buildNote({
          noteId: "note-1",
          title: "Aria Vale",
          content: "<p>Original content</p>",
        }),
      ],
    });

    const capturedBodies: any[] = [];
    let callCount = 0;

    await page.route("**/api/lore/note-1/copilot/stream", async (route) => {
      const body = route.request().postDataJSON();
      capturedBodies.push(body);
      callCount++;

      const result = {
        sessionId: "sess-abc123",
        assistantMessage: callCount === 1 ? "First response." : "Fresh response after clear.",
        citations: [],
        proposal: null,
      };
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: [
          `event: token\ndata: ${JSON.stringify({ content: "Thinking..." })}\n\n`,
          `event: result\ndata: ${JSON.stringify(result)}\n\n`,
        ].join(""),
      });
    });

    await page.goto("/lore/note-1");
    await page.getByRole("button", { name: /lore copilot/i }).click();

    // Send first message to establish a sessionId
    await page.getByPlaceholder(/Ask for article edits/i).fill("Make her sound more epic");
    await page.getByRole("button", { name: /^Send$/i }).click();
    await expect(page.getByText("First response.")).toBeVisible();

    expect(capturedBodies).toHaveLength(1);
    expect(capturedBodies[0].sessionId).toBeUndefined();

    // Reload the page to clear Zustand in-memory state (no persist middleware)
    await page.reload();

    // Reopen copilot after reload
    await page.getByRole("button", { name: /lore copilot/i }).click();
    await expect(page.getByRole("heading", { name: "Article-Scoped Copilot" })).toBeVisible();

    // Send another message — sessionId should NOT be present since state was cleared
    await page.getByPlaceholder(/Ask for article edits/i).fill("Start a new conversation");
    await page.getByRole("button", { name: /^Send$/i }).click();
    await expect(page.getByText("Fresh response after clear.")).toBeVisible();

    expect(capturedBodies).toHaveLength(2);
    expect(capturedBodies[1].sessionId).toBeUndefined();

    await expectNoConsoleErrors(errors);
  });

  test("session continues across proposal dismiss and redirect", async ({ page }) => {
    const errors = attachConsoleErrorCollector(page);
    await installPortalApiMocks(page, {
      notes: [
        buildNote({
          noteId: "note-1",
          title: "Aria Vale",
          content: "<p>Original content</p>",
        }),
      ],
    });

    const capturedBodies: any[] = [];
    let callCount = 0;

    await page.route("**/api/lore/note-1/copilot/stream", async (route) => {
      const body = route.request().postDataJSON();
      capturedBodies.push(body);
      callCount++;

      if (callCount === 1) {
        // First call: return a proposal with sessionId (no contentHtml to keep card short)
        const result = {
          sessionId: "sess-redirect-001",
          assistantMessage: "Here is a proposal.",
          citations: [],
          proposal: {
            targets: [
              {
                kind: "update",
                targetId: "note-1",
                title: "Aria Vale, the Warden",
                rationale: "Added title.",
                labelUpserts: [],
                labelDeletes: [],
                relationAdds: [],
                relationDeletes: [],
              },
            ],
          },
        };
        await route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          body: [
            `event: token\ndata: ${JSON.stringify({ content: "Thinking..." })}\n\n`,
            `event: result\ndata: ${JSON.stringify(result)}\n\n`,
          ].join(""),
        });
      } else {
        // Second call (redirect): verify sessionId is present, return without proposal
        const result = {
          sessionId: "sess-redirect-001",
          assistantMessage: "Understood, revising approach.",
          citations: [],
          proposal: null,
        };
        await route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          body: [
            `event: token\ndata: ${JSON.stringify({ content: "Thinking..." })}\n\n`,
            `event: result\ndata: ${JSON.stringify(result)}\n\n`,
          ].join(""),
        });
      }
    });

    await page.goto("/lore/note-1");
    await page.getByRole("button", { name: /lore copilot/i }).click();

    // Send first message
    await page.getByPlaceholder(/Ask for article edits/i).fill("Make her sound more epic");
    await page.getByRole("button", { name: /^Send$/i }).click();

    // Wait for proposal to appear
    await expect(page.getByText("Aria Vale, the Warden").first()).toBeVisible();

    // First request should have no sessionId
    expect(capturedBodies).toHaveLength(1);
    expect(capturedBodies[0].sessionId).toBeUndefined();

    // Dismiss proposal via Cancel + Redirect
    await page.getByRole("button", { name: /Cancel \+ Redirect/i }).click();
    await page.getByPlaceholder(/Instead of this proposal, please/i).fill("Fix the spelling instead");
    await page.locator('button:has-text("Send Revision")').evaluate(el => (el as HTMLElement).click());

    // Wait for redirect response
    await expect(page.getByText("Understood, revising approach.")).toBeVisible();

    // Second request (redirect) should include sessionId from first response
    expect(capturedBodies).toHaveLength(2);
    expect(capturedBodies[1].sessionId).toBe("sess-redirect-001");

    // Verify the redirect message content was sent correctly
    const lastMessage = capturedBodies[1].messages[capturedBodies[1].messages.length - 1];
    expect(lastMessage.content).toContain("I'm rejecting the previous proposal. Instead: Fix the spelling instead");

    await expectNoConsoleErrors(errors);
  });
});
