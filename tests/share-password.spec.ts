import { test, expect } from "@playwright/test";
import { buildNote, installPortalApiMocks } from "./helpers/mock-api";

test.describe("Share Password Settings", () => {
  test("enables and removes password protection on a lore note", async ({ page }) => {
    let mocks: any;
    mocks = await installPortalApiMocks(page, {
      notes: [
        buildNote({
          noteId: "note-1",
          title: "Secret Vault",
        }),
      ],
    });

    let attributeCreated = false;
    let attributeDeleted = false;

    await page.route("**/api/lore/*/attributes**", async (route) => {
      const req = route.request();
      if (req.method() === "POST") {
        const body = req.postDataJSON();
        if (body.name === "shareCredentials") {
          attributeCreated = true;
          const note = mocks.getNote("note-1");
          if (note) {
            note.attributes.push({ attributeId: "attr-cred-1", name: "shareCredentials", value: body.value, type: "label" });
            mocks.upsertNote(note);
          }
          await route.fulfill({
            status: 200,
            body: JSON.stringify({
              attributeId: "attr-cred-1",
              name: "shareCredentials",
              value: body.value,
              type: "label",
            }),
          });
          return;
        }
      } else if (req.method() === "DELETE") {
        const url = new URL(req.url());
        if (url.searchParams.get("attrId") === "attr-cred-1") {
          attributeDeleted = true;
          const note = mocks.getNote("note-1");
          if (note) {
            note.attributes = note.attributes.filter((a: any) => a.attributeId !== "attr-cred-1");
            mocks.upsertNote(note);
          }
          await route.fulfill({ status: 204, body: "" });
          return;
        }
      }
      await route.fallback();
    });

    await page.goto("/lore/note-1");

    // Click "Enable" on Password
    await page.getByRole("button", { name: "Enable" }).click();

    // Fill credentials
    await page.getByPlaceholder("Username").fill("vault");
    await page.getByPlaceholder(/Password/i).fill("secret123");

    // Save
    await page.getByRole("button", { name: "Save Credentials" }).click();

    // Verify it changed to "Remove" and created attribute
    await expect(page.getByRole("button", { name: "Remove" })).toBeVisible();
    expect(attributeCreated).toBe(true);

    // Click Remove
    await page.getByRole("button", { name: "Remove" }).click();

    // Verify it changed back to Enable and deleted attribute
    await expect(page.getByRole("button", { name: "Enable" })).toBeVisible();
    expect(attributeDeleted).toBe(true);
  });
});
