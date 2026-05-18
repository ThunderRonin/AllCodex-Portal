import { test, expect, type Page, type Route } from "@playwright/test";
import { buildNote, installPortalApiMocks } from "./helpers/mock-api";
import {
  attachConsoleErrorCollector,
  expectNoConsoleErrors,
} from "./helpers/test-utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MapMockData {
  imageUrl: string | null;
  width: number;
  height: number;
  pins: Array<{
    noteId: string;
    title: string;
    loreType: string | null;
    x: number;
    y: number;
    description?: string;
  }>;
}

const DEFAULT_MAP_DATA: MapMockData = {
  imageUrl: "/api/lore/map-img-1/content",
  width: 2048,
  height: 1536,
  pins: [
    { noteId: "loc-1", title: "Ironforge Citadel", loreType: "location", x: 500, y: 400 },
    { noteId: "loc-2", title: "Whisperwind Glade", loreType: "location", x: 1200, y: 800 },
    { noteId: "loc-3", title: "The Sunken Temple", loreType: "dungeon", x: 800, y: 1100, description: "An ancient ruin submerged beneath the marshlands." },
  ],
};

/**
 * Register mock routes for `/api/lore/:id/map` and `/api/lore/:id/map/upload`.
 * Must be called AFTER `installPortalApiMocks` so these more-specific routes
 * take priority in Playwright's LIFO matching.
 */
async function setupMapMocks(
  page: Page,
  mapData: MapMockData = DEFAULT_MAP_DATA,
  uploadResponse?: { status?: number; body: Record<string, unknown> },
) {
  await page.route("**/api/lore/*/map/upload", async (route: Route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    const resp = uploadResponse ?? {
      body: { imageNoteId: "map-img-new", width: 2048, height: 1536 },
    };
    await route.fulfill({
      status: resp.status ?? 200,
      contentType: "application/json",
      body: JSON.stringify(resp.body),
    });
  });

  await page.route("**/api/lore/*/map", async (route: Route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mapData),
    });
  });
}

/** Build a note with the `viewType=geoMap` attribute required by the lore detail page. */
function buildGeoMapNote(
  overrides: Partial<Parameters<typeof buildNote>[0]> & { noteId: string; title: string },
) {
  const attrs = overrides.attributes ?? [
    { attributeId: `attr-lore-${overrides.noteId}`, name: "lore", value: "", type: "label" as const },
    { attributeId: `attr-type-${overrides.noteId}`, name: "loreType", value: "location", type: "label" as const },
    { attributeId: `attr-vt-${overrides.noteId}`, name: "viewType", value: "geoMap", type: "label" as const },
  ];
  return buildNote({ ...overrides, attributes: attrs });
}

const LEAFLET_TIMEOUT = 10_000;

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe("MapViewer — rendering", () => {
  test("renders Leaflet container when GeoMap note has a background image", async ({ page }) => {
    const errors = attachConsoleErrorCollector(page);
    await installPortalApiMocks(page, {
      notes: [buildGeoMapNote({ noteId: "map-1", title: "Realm of Aethon" })],
    });
    await setupMapMocks(page, DEFAULT_MAP_DATA);

    await page.goto("/lore/map-1");
    await page.waitForSelector(".leaflet-container", { timeout: LEAFLET_TIMEOUT });

    await expect(page.locator(".leaflet-container")).toBeVisible();
    await expectNoConsoleErrors(errors);
  });

  test("shows loading skeleton before map data resolves", async ({ page }) => {
    const errors = attachConsoleErrorCollector(page);
    await installPortalApiMocks(page, {
      notes: [buildGeoMapNote({ noteId: "map-1", title: "Realm of Aethon" })],
    });

    // Delay the map API response so we can catch the loading state
    await page.route("**/api/lore/*/map", async (route) => {
      await new Promise((r) => setTimeout(r, 2_000));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(DEFAULT_MAP_DATA),
      });
    });

    await page.goto("/lore/map-1");

    // Before Leaflet loads, a skeleton / pulse placeholder should be visible
    const skeleton = page.locator(".animate-pulse").first();
    await expect(skeleton).toBeVisible({ timeout: 3_000 });
    await expectNoConsoleErrors(errors);
  });

  test("renders image overlay within the Leaflet map", async ({ page }) => {
    const errors = attachConsoleErrorCollector(page);
    await installPortalApiMocks(page, {
      notes: [buildGeoMapNote({ noteId: "map-1", title: "Realm of Aethon" })],
    });
    await setupMapMocks(page, DEFAULT_MAP_DATA);

    await page.goto("/lore/map-1");
    await page.waitForSelector(".leaflet-container", { timeout: LEAFLET_TIMEOUT });

    // Leaflet adds an <img> inside .leaflet-image-layer for the overlay
    const overlay = page.locator(".leaflet-container img.leaflet-image-layer");
    await expect(overlay).toHaveCount(1);
    await expectNoConsoleErrors(errors);
  });
});

test.describe("MapViewer — pins", () => {
  test("renders pin markers for each child Location note with #geolocation", async ({ page }) => {
    const errors = attachConsoleErrorCollector(page);
    await installPortalApiMocks(page, {
      notes: [buildGeoMapNote({ noteId: "map-1", title: "World Map" })],
    });
    await setupMapMocks(page, DEFAULT_MAP_DATA);

    await page.goto("/lore/map-1");
    await page.waitForSelector(".leaflet-container", { timeout: LEAFLET_TIMEOUT });

    const pins = page.locator(".map-pin-icon");
    await expect(pins).toHaveCount(3);
    await expectNoConsoleErrors(errors);
  });

  test("pin popup shows note title on click", async ({ page }) => {
    const errors = attachConsoleErrorCollector(page);
    await installPortalApiMocks(page, {
      notes: [
        buildGeoMapNote({ noteId: "map-1", title: "World Map" }),
        buildNote({ noteId: "loc-1", title: "Ironforge Citadel" }),
      ],
    });
    await setupMapMocks(page, DEFAULT_MAP_DATA);

    await page.goto("/lore/map-1");
    await page.waitForSelector(".leaflet-container", { timeout: LEAFLET_TIMEOUT });

    // Click the first pin marker
    const firstPin = page.locator(".map-pin-icon").first();
    await firstPin.click();

    // The popup should appear with the title inside
    const popup = page.locator(".leaflet-popup-content .map-pin-popup");
    await expect(popup).toBeVisible({ timeout: 3_000 });
    await expect(popup.locator("strong")).toContainText("Ironforge Citadel");
    await expectNoConsoleErrors(errors);
  });

  test("pin popup shows description when available", async ({ page }) => {
    const errors = attachConsoleErrorCollector(page);
    await installPortalApiMocks(page, {
      notes: [buildGeoMapNote({ noteId: "map-1", title: "World Map" })],
    });
    // Only one pin with a description
    await setupMapMocks(page, {
      ...DEFAULT_MAP_DATA,
      pins: [
        {
          noteId: "loc-3",
          title: "The Sunken Temple",
          loreType: "dungeon",
          x: 800,
          y: 1100,
          description: "An ancient ruin submerged beneath the marshlands.",
        },
      ],
    });

    await page.goto("/lore/map-1");
    await page.waitForSelector(".leaflet-container", { timeout: LEAFLET_TIMEOUT });

    await page.locator(".map-pin-icon").first().click();

    const popupContent = page.locator(".leaflet-popup-content .map-pin-popup");
    await expect(popupContent).toBeVisible({ timeout: 3_000 });
    await expect(popupContent).toContainText("An ancient ruin submerged");
    await expectNoConsoleErrors(errors);
  });

  test("pin popup shows loreType label when present", async ({ page }) => {
    const errors = attachConsoleErrorCollector(page);
    await installPortalApiMocks(page, {
      notes: [buildGeoMapNote({ noteId: "map-1", title: "World Map" })],
    });
    await setupMapMocks(page, {
      ...DEFAULT_MAP_DATA,
      pins: [
        { noteId: "loc-1", title: "Ironforge Citadel", loreType: "location", x: 500, y: 400 },
      ],
    });

    await page.goto("/lore/map-1");
    await page.waitForSelector(".leaflet-container", { timeout: LEAFLET_TIMEOUT });

    await page.locator(".map-pin-icon").first().click();

    const popup = page.locator(".leaflet-popup-content .map-pin-popup");
    await expect(popup).toBeVisible({ timeout: 3_000 });
    await expect(popup).toContainText("(location)");
    await expectNoConsoleErrors(errors);
  });

  test("pin click navigates to the lore note detail page", async ({ page }) => {
    const errors = attachConsoleErrorCollector(page);
    await installPortalApiMocks(page, {
      notes: [
        buildGeoMapNote({ noteId: "map-1", title: "World Map" }),
        buildNote({ noteId: "loc-1", title: "Ironforge Citadel" }),
      ],
    });
    await setupMapMocks(page, {
      ...DEFAULT_MAP_DATA,
      pins: [
        { noteId: "loc-1", title: "Ironforge Citadel", loreType: "location", x: 500, y: 400 },
      ],
    });

    await page.goto("/lore/map-1");
    await page.waitForSelector(".leaflet-container", { timeout: LEAFLET_TIMEOUT });

    await page.locator(".map-pin-icon").first().click();

    // onPinClick calls router.push(`/lore/${id}`)
    await expect(page).toHaveURL(/\/lore\/loc-1/, { timeout: 5_000 });
    await expectNoConsoleErrors(errors);
  });

  test("map with zero pins renders without errors", async ({ page }) => {
    const errors = attachConsoleErrorCollector(page);
    await installPortalApiMocks(page, {
      notes: [buildGeoMapNote({ noteId: "map-1", title: "Empty Realm" })],
    });
    await setupMapMocks(page, {
      imageUrl: "/api/lore/map-img-1/content",
      width: 1024,
      height: 768,
      pins: [],
    });

    await page.goto("/lore/map-1");
    await page.waitForSelector(".leaflet-container", { timeout: LEAFLET_TIMEOUT });

    await expect(page.locator(".leaflet-container")).toBeVisible();
    await expect(page.locator(".map-pin-icon")).toHaveCount(0);
    await expectNoConsoleErrors(errors);
  });

  test("map with only one pin still renders correctly", async ({ page }) => {
    const errors = attachConsoleErrorCollector(page);
    await installPortalApiMocks(page, {
      notes: [buildGeoMapNote({ noteId: "map-1", title: "Solo Pin Map" })],
    });
    await setupMapMocks(page, {
      imageUrl: "/api/lore/map-img-1/content",
      width: 2048,
      height: 1536,
      pins: [
        { noteId: "loc-only", title: "Lone Tower", loreType: "location", x: 1024, y: 768 },
      ],
    });

    await page.goto("/lore/map-1");
    await page.waitForSelector(".leaflet-container", { timeout: LEAFLET_TIMEOUT });

    await expect(page.locator(".map-pin-icon")).toHaveCount(1);
    await expectNoConsoleErrors(errors);
  });

  test("very large coordinates near map edge still produce marker DOM elements", async ({ page }) => {
    const errors = attachConsoleErrorCollector(page);
    await installPortalApiMocks(page, {
      notes: [buildGeoMapNote({ noteId: "map-1", title: "Edge Map" })],
    });
    await setupMapMocks(page, {
      imageUrl: "/api/lore/map-img-1/content",
      width: 2048,
      height: 1536,
      pins: [
        { noteId: "edge-1", title: "Far Corner", loreType: "location", x: 2047, y: 1535 },
        { noteId: "edge-2", title: "Origin", loreType: "location", x: 0, y: 0 },
        { noteId: "edge-3", title: "Off-Bounds", loreType: "location", x: 99999, y: 99999 },
      ],
    });

    await page.goto("/lore/map-1");
    await page.waitForSelector(".leaflet-container", { timeout: LEAFLET_TIMEOUT });

    // All 3 markers should exist in the DOM even if off-screen
    await expect(page.locator(".map-pin-icon")).toHaveCount(3);
    await expectNoConsoleErrors(errors);
  });

  test("negative coordinates produce marker DOM elements", async ({ page }) => {
    const errors = attachConsoleErrorCollector(page);
    await installPortalApiMocks(page, {
      notes: [buildGeoMapNote({ noteId: "map-1", title: "Neg Map" })],
    });
    await setupMapMocks(page, {
      imageUrl: "/api/lore/map-img-1/content",
      width: 2048,
      height: 1536,
      pins: [
        { noteId: "neg-1", title: "Below Zero", loreType: "location", x: -100, y: -200 },
      ],
    });

    await page.goto("/lore/map-1");
    await page.waitForSelector(".leaflet-container", { timeout: LEAFLET_TIMEOUT });

    await expect(page.locator(".map-pin-icon")).toHaveCount(1);
    await expectNoConsoleErrors(errors);
  });
});

test.describe("MapViewer — upload flow", () => {
  test("shows upload UI when GeoMap note has no background image", async ({ page }) => {
    const errors = attachConsoleErrorCollector(page);
    await installPortalApiMocks(page, {
      notes: [buildGeoMapNote({ noteId: "map-1", title: "Blank Map" })],
    });
    await setupMapMocks(page, {
      imageUrl: null,
      width: 1000,
      height: 1000,
      pins: [],
    });

    await page.goto("/lore/map-1");

    // MapUpload shows "Choose Image" button and descriptive text
    await expect(page.getByText("Upload a background map image")).toBeVisible();
    await expect(page.getByRole("button", { name: /choose image/i })).toBeVisible();
    // No leaflet container should exist
    await expect(page.locator(".leaflet-container")).toHaveCount(0);
    await expectNoConsoleErrors(errors);
  });

  test("upload button is visible and clickable", async ({ page }) => {
    const errors = attachConsoleErrorCollector(page);
    await installPortalApiMocks(page, {
      notes: [buildGeoMapNote({ noteId: "map-1", title: "Empty Map" })],
    });
    await setupMapMocks(page, {
      imageUrl: null,
      width: 1000,
      height: 1000,
      pins: [],
    });

    await page.goto("/lore/map-1");

    const uploadBtn = page.getByRole("button", { name: /choose image/i });
    await expect(uploadBtn).toBeVisible();
    await expect(uploadBtn).toBeEnabled();
    await expectNoConsoleErrors(errors);
  });

  test("file input triggers upload and map re-renders with new image after success", async ({ page }) => {
    const errors = attachConsoleErrorCollector(page);
    let mapCallCount = 0;

    await installPortalApiMocks(page, {
      notes: [buildGeoMapNote({ noteId: "map-1", title: "Upload Test Map" })],
    });

    // Upload returns success
    await page.route("**/api/lore/*/map/upload", async (route) => {
      if (route.request().method() !== "POST") {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ imageNoteId: "map-img-new", width: 2048, height: 1536 }),
      });
    });

    // First call: no image. After upload, onUploaded triggers a re-fetch that returns image.
    await page.route("**/api/lore/*/map", async (route) => {
      if (route.request().method() !== "GET") {
        await route.fallback();
        return;
      }
      mapCallCount++;
      if (mapCallCount <= 1) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ imageUrl: null, width: 1000, height: 1000, pins: [] }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            imageUrl: "/api/lore/map-img-new/content",
            width: 2048,
            height: 1536,
            pins: [],
          }),
        });
      }
    });

    await page.goto("/lore/map-1");

    // Initially shows upload UI
    await expect(page.getByText("Upload a background map image")).toBeVisible();

    // Set file directly on the hidden input (bypasses the button click → input.click() indirection)
    const fileInput = page.locator('input[type="file"][accept="image/*"]');
    await fileInput.setInputFiles({
      name: "realm-map.png",
      mimeType: "image/png",
      buffer: Buffer.from("fake-png-content"),
    });

    // After upload succeeds, MapSection calls loadMap again and MapViewer should appear
    await page.waitForSelector(".leaflet-container", { timeout: LEAFLET_TIMEOUT });
    await expect(page.locator(".leaflet-container")).toBeVisible();
    await expectNoConsoleErrors(errors);
  });

  test("upload failure shows error message", async ({ page }) => {
    const errors = attachConsoleErrorCollector(page);
    await installPortalApiMocks(page, {
      notes: [buildGeoMapNote({ noteId: "map-1", title: "Fail Upload Map" })],
    });

    await page.route("**/api/lore/*/map/upload", async (route) => {
      if (route.request().method() !== "POST") {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "INVALID_REQUEST", message: "Image file required" }),
      });
    });

    await page.route("**/api/lore/*/map", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ imageUrl: null, width: 1000, height: 1000, pins: [] }),
      });
    });

    await page.goto("/lore/map-1");
    await expect(page.getByText("Upload a background map image")).toBeVisible();

    const fileInput = page.locator('input[type="file"][accept="image/*"]');
    await fileInput.setInputFiles({
      name: "bad.txt",
      mimeType: "image/png",
      buffer: Buffer.from("not-an-image"),
    });

    // MapUpload displays error via .text-destructive
    const errorMsg = page.locator(".text-destructive");
    await expect(errorMsg).toBeVisible({ timeout: 5_000 });
    await expect(errorMsg).toContainText(/image file required/i);
    // Console errors from upload failure are expected — only assert no unrelated crashes
  });
});

test.describe("MapViewer — error states", () => {
  test("map API failure shows error text gracefully (no crash)", async ({ page }) => {
    const errors = attachConsoleErrorCollector(page);
    await installPortalApiMocks(page, {
      notes: [buildGeoMapNote({ noteId: "map-1", title: "Error Map" })],
    });

    await page.route("**/api/lore/*/map", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "SERVICE_ERROR", message: "Internal failure" }),
      });
    });

    await page.goto("/lore/map-1");

    // MapSection catches the error and shows an error message
    const errorText = page.locator(".text-destructive");
    await expect(errorText).toBeVisible({ timeout: 5_000 });
    await expect(errorText).toContainText(/failed to load map/i);

    // No leaflet container should appear
    await expect(page.locator(".leaflet-container")).toHaveCount(0);
  });

  test("map API returns 503 when AllCodex not configured shows error gracefully", async ({ page }) => {
    const errors = attachConsoleErrorCollector(page);
    await installPortalApiMocks(page, {
      notes: [buildGeoMapNote({ noteId: "map-1", title: "Unconfigured Map" })],
    });

    await page.route("**/api/lore/*/map", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: "NOT_CONFIGURED",
          message: "AllCodex is not connected. Go to Settings to add credentials.",
        }),
      });
    });

    await page.goto("/lore/map-1");

    const errorText = page.locator(".text-destructive");
    await expect(errorText).toBeVisible({ timeout: 5_000 });
    await expect(errorText).toContainText(/failed to load map/i);
    await expect(page.locator(".leaflet-container")).toHaveCount(0);
  });

  test("note without viewType=geoMap does NOT render the MapSection at all", async ({ page }) => {
    const errors = attachConsoleErrorCollector(page);
    // Normal note, no viewType=geoMap
    await installPortalApiMocks(page, {
      notes: [
        buildNote({
          noteId: "note-1",
          title: "Aria Vale",
          attributes: [
            { attributeId: "attr-lore-note-1", name: "lore", value: "", type: "label" },
            { attributeId: "attr-type-note-1", name: "loreType", value: "character", type: "label" },
          ],
          content: "<h1>Aria Vale</h1><p>Warden of the northern archive.</p>",
        }),
      ],
    });

    await page.goto("/lore/note-1");

    // Wait for the page to fully render
    await expect(page.locator(".wiki-page-title")).toBeVisible();

    // No map section should exist
    await expect(page.locator(".leaflet-container")).toHaveCount(0);
    await expect(page.getByText("Upload a background map image")).toHaveCount(0);
    await expectNoConsoleErrors(errors);
  });

  test("invalid noteId in map API route returns error without page crash", async ({ page }) => {
    const errors = attachConsoleErrorCollector(page);

    // Create a GeoMap note so the section renders, but mock the map API to 404
    await installPortalApiMocks(page, {
      notes: [buildGeoMapNote({ noteId: "map-bad", title: "Bad ID Map" })],
    });

    await page.route("**/api/lore/*/map", async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "Not found" }),
      });
    });

    await page.goto("/lore/map-bad");

    // MapSection sets error on non-ok response
    const errorText = page.locator(".text-destructive");
    await expect(errorText).toBeVisible({ timeout: 5_000 });

    // Page should still be usable (not a white screen / unhandled error)
    await expect(page.locator(".wiki-page-title")).toBeVisible();
  });

  test("map API network timeout shows error gracefully", async ({ page }) => {
    const errors = attachConsoleErrorCollector(page);
    await installPortalApiMocks(page, {
      notes: [buildGeoMapNote({ noteId: "map-1", title: "Timeout Map" })],
    });

    await page.route("**/api/lore/*/map", async (route) => {
      // Abort the request to simulate network failure
      await route.abort("timedout");
    });

    await page.goto("/lore/map-1");

    const errorText = page.locator(".text-destructive");
    await expect(errorText).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".leaflet-container")).toHaveCount(0);
  });
});

test.describe("MapViewer — map section header", () => {
  test("map section shows Map heading with icon for GeoMap notes", async ({ page }) => {
    const errors = attachConsoleErrorCollector(page);
    await installPortalApiMocks(page, {
      notes: [buildGeoMapNote({ noteId: "map-1", title: "Headed Map" })],
    });
    await setupMapMocks(page, DEFAULT_MAP_DATA);

    await page.goto("/lore/map-1");

    // The lore detail page wraps MapSection in a section with heading "Map"
    const mapHeading = page.locator(".wiki-section-title", { hasText: "Map" });
    await expect(mapHeading).toBeVisible();
    await expectNoConsoleErrors(errors);
  });
});
