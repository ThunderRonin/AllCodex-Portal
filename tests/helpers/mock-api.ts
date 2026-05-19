import type { Page, Route } from "@playwright/test";

type Attribute = {
  attributeId: string;
  name: string;
  value: string;
  type: "label" | "relation";
};

type NoteRecord = {
  noteId: string;
  title: string;
  type: string;
  dateCreated: string;
  dateModified: string;
  attributes: Attribute[];
  parentNoteIds: string[];
  content: string;
};

type BrainDumpResponse = {
  status?: number;
  body: unknown;
  delayMs?: number;
};

type RelationshipsResponse = {
  suggestions: Array<{
    targetNoteId: string;
    targetTitle: string;
    relationshipType: string;
    description: string;
  }>;
};

type GapsResponse = {
  status?: number;
  body: unknown;
};

type ConsistencyResponse = {
  status?: number;
  body: unknown;
};

type SearchResult = {
  noteId: string;
  title: string;
  type: string;
  loreType?: string | null;
  snippet?: string;
  score?: number;
};

type HistoryEntry = {
  id: string;
  rawText: string;
  summary: string | null;
  notesCreated: string[];
  notesUpdated: string[];
  model: string;
  tokensUsed: number | null;
  createdAt: string;
};

type MentionSuggestion = {
  noteId: string;
  title: string;
  loreType: string;
};

type BacklinkEntry = {
  noteId: string;
  title: string;
  loreType: string | null;
};

/**
 * Determines whether a note contains a "lore" or "loreType" label attribute.
 *
 * @param note - The note record to inspect; may be `undefined`.
 * @returns `true` if the note has at least one label attribute named `lore` or `loreType`, `false` otherwise.
 */
function isLoreNoteRecord(note: NoteRecord | undefined): boolean {
  return (
    note?.attributes.some(
      (attribute) =>
        attribute.type === "label" &&
        (attribute.name === "lore" || attribute.name === "loreType"),
    ) ?? false
  );
}

/**
 * Normalize image source URLs in HTML to a canonical `/api/images/{id}/image` form.
 *
 * Scans `html` for several common portal image URL patterns (including legacy or relative
 * `/api/images/...` paths and `/api/lore/{id}/image`) and rewrites them to use the
 * absolute `/api/images/{id}/image` form.
 *
 * @param html - HTML content containing image `src` attributes
 * @returns The input HTML with image `src` values rewritten to the canonical paths
 */
function normalizePortalImageHtml(html: string) {
  return html
    .replace(/src=["'][^"']*\/api\/lore\/([a-zA-Z0-9_]+)\/image["']/gi, 'src="/api/images/$1/image"')
    .replace(/src=["']api\/images\//gi, 'src="/api/images/')
    .replace(/src=["'][^"']*\/api\/images\//gi, 'src="/api/images/');
}

type AutolinkMatch = {
  term: string;
  noteId: string;
  title: string;
};

type TimelineNote = {
  noteId: string;
  title: string;
  attributes: Array<{ name: string; value: string; type: string }>;
};

type ShareItem = {
  noteId: string;
  title: string;
  loreType: string | null;
  isDraft: boolean;
  isGmOnly: boolean;
  shareAlias: string | null;
  isProtected: boolean;
  dateModified: string;
};

export type PortalMockOptions = {
  notes?: NoteRecord[];
  ragStatus?: { indexedNotes: number; model: string };
  brainDump?: BrainDumpResponse;
  relationships?: RelationshipsResponse;
  gaps?: GapsResponse;
  consistency?: ConsistencyResponse;
  mentionSuggestions?: MentionSuggestion[];
  backlinks?: Record<string, BacklinkEntry[]>;
  autolinkMatches?: AutolinkMatch[];
  breadcrumbs?: Record<string, Array<{ noteId: string; title: string }>>;
  searchResults?: SearchResult[];
  quests?: NoteRecord[];
  statblocks?: NoteRecord[];
  brainDumpHistory?: HistoryEntry[];
  timeline?: TimelineNote[];
  shareTree?: ShareItem[];
  configStatus?: {
    allcodex: { ok?: boolean; connected?: boolean; configured?: boolean; url: string; version?: string; error?: string };
    allknower: { ok?: boolean; connected?: boolean; configured?: boolean; url: string; error?: string };
  };
};

export function buildNote(overrides: Partial<NoteRecord> & Pick<NoteRecord, "noteId" | "title">): NoteRecord {
  const now = new Date().toISOString();
  return {
    noteId: overrides.noteId,
    title: overrides.title,
    type: overrides.type ?? "text",
    dateCreated: overrides.dateCreated ?? now,
    dateModified: overrides.dateModified ?? now,
    parentNoteIds: overrides.parentNoteIds ?? ["root"],
    attributes: overrides.attributes ?? [
      { attributeId: `attr-lore-${overrides.noteId}`, name: "lore", value: "", type: "label" },
      { attributeId: `attr-type-${overrides.noteId}`, name: "loreType", value: "character", type: "label" },
    ],
    content: overrides.content ?? `<h1>${escapeHtml(overrides.title)}</h1><p>Chronicle entry body.</p>`,
  };
}

export function buildQuest(overrides: Partial<NoteRecord> & Pick<NoteRecord, "noteId" | "title">): NoteRecord {
  const now = new Date().toISOString();
  const status = (overrides.attributes?.find((a) => a.name === "questStatus")?.value) ?? "active";
  return {
    noteId: overrides.noteId,
    title: overrides.title,
    type: overrides.type ?? "text",
    dateCreated: overrides.dateCreated ?? now,
    dateModified: overrides.dateModified ?? now,
    parentNoteIds: overrides.parentNoteIds ?? ["root"],
    attributes: overrides.attributes ?? [
      { attributeId: `attr-lore-${overrides.noteId}`, name: "lore", value: "", type: "label" },
      { attributeId: `attr-type-${overrides.noteId}`, name: "loreType", value: "quest", type: "label" },
      { attributeId: `attr-status-${overrides.noteId}`, name: "questStatus", value: status, type: "label" },
      { attributeId: `attr-loc-${overrides.noteId}`, name: "location", value: overrides.title + " Vicinity", type: "label" },
    ],
    content: overrides.content ?? `<h1>${escapeHtml(overrides.title)}</h1><p>Quest entry body.</p>`,
  };
}

export function buildStatblock(overrides: Partial<NoteRecord> & Pick<NoteRecord, "noteId" | "title">): NoteRecord {
  const now = new Date().toISOString();
  return {
    noteId: overrides.noteId,
    title: overrides.title,
    type: overrides.type ?? "text",
    dateCreated: overrides.dateCreated ?? now,
    dateModified: overrides.dateModified ?? now,
    parentNoteIds: overrides.parentNoteIds ?? ["root"],
    attributes: overrides.attributes ?? [
      { attributeId: `attr-lore-${overrides.noteId}`, name: "lore", value: "", type: "label" },
      { attributeId: `attr-type-${overrides.noteId}`, name: "loreType", value: "creature", type: "label" },
      { attributeId: `attr-statblock-${overrides.noteId}`, name: "statblock", value: "", type: "label" },
      { attributeId: `attr-cr-${overrides.noteId}`, name: "challengeRating", value: "2", type: "label" },
      { attributeId: `attr-type2-${overrides.noteId}`, name: "creatureType", value: "beast", type: "label" },
      { attributeId: `attr-ac-${overrides.noteId}`, name: "ac", value: "13", type: "label" },
      { attributeId: `attr-hp-${overrides.noteId}`, name: "hp", value: "45", type: "label" },
      { attributeId: `attr-spd-${overrides.noteId}`, name: "speed", value: "30 ft.", type: "label" },
      { attributeId: `attr-str-${overrides.noteId}`, name: "str", value: "16", type: "label" },
      { attributeId: `attr-dex-${overrides.noteId}`, name: "dex", value: "12", type: "label" },
      { attributeId: `attr-con-${overrides.noteId}`, name: "con", value: "14", type: "label" },
      { attributeId: `attr-int-${overrides.noteId}`, name: "int", value: "6", type: "label" },
      { attributeId: `attr-wis-${overrides.noteId}`, name: "wis", value: "8", type: "label" },
      { attributeId: `attr-cha-${overrides.noteId}`, name: "cha", value: "5", type: "label" },
    ],
    content: overrides.content ?? `<h1>${escapeHtml(overrides.title)}</h1>`,
  };
}

/**
 * Installs a comprehensive set of Playwright route mocks that emulate the Portal backend API for tests.
 *
 * Registers route handlers for configuration, sharing, notes (CRUD, content, preview, images, attributes, backlinks, searches),
 * AI endpoints (brain-dump SSE and JSON, relationships, gaps, consistency), imports, integrations, auth, timeline, quests, statblocks,
 * and other test helpers. Handlers are seeded with reasonable defaults which can be overridden via `options`.
 *
 * @param page - Playwright Page instance on which mock routes will be registered.
 * @param options - Optional overrides for the mocked datasets and behaviors (e.g., notes, searchResults, brainDump, backlinks, etc.).
 * @returns An in-memory test API with:
 *   - `getNote(noteId)` — returns the mocked `NoteRecord` for `noteId` if present.
 *   - `upsertNote(note)` — stores or updates a `NoteRecord` in the mock store and updates ordering.
 */
export async function installPortalApiMocks(page: Page, options: PortalMockOptions = {}) {
  const notes = new Map<string, NoteRecord>();
  const orderedNoteIds: string[] = [];
  const ragStatus = options.ragStatus ?? { indexedNotes: 3, model: "mock-embedder" };
  const brainDump = options.brainDump ?? {
    body: {
      mode: "auto",
      summary: "Extracted two lore fragments",
      created: [{ noteId: "brain-1", title: "Vault Oath", type: "event", action: "created" }],
      updated: [],
      skipped: [],
    },
    delayMs: 150,
  };
  const relationships = options.relationships ?? {
    suggestions: [
      {
        targetNoteId: "ally-1",
        targetTitle: "Aether Keep",
        relationshipType: "ally",
        description: "Supports the current lore entry.",
      },
    ],
  };
  const backlinks = options.backlinks ?? {};
  const gaps = options.gaps ?? {
    body: {
      gaps: [
        {
          area: "Factions",
          severity: "medium",
          description: "Political structure is still thin.",
          suggestion: "Add a rival guild to anchor the region.",
        },
      ],
    },
  };
  const consistency = options.consistency ?? {
    body: { issues: [], summary: "Lore is consistent." },
  };
  const searchResultsDefault: SearchResult[] = [
    { noteId: "note-1", title: "Aria Vale", type: "text", loreType: "character", snippet: "Warden of the northern archive.", score: 0.92 },
    { noteId: "note-2", title: "Aether Keep", type: "text", loreType: "location", snippet: "Fortress built above the ley breach.", score: 0.85 },
  ];
  const searchResults = options.searchResults ?? searchResultsDefault;
  const questsNotes = options.quests ?? [
    buildQuest({ noteId: "quest-1", title: "The Lost Seal",
      attributes: [
        { attributeId: "attr-lore-quest-1", name: "lore", value: "", type: "label" },
        { attributeId: "attr-type-quest-1", name: "loreType", value: "quest", type: "label" },
        { attributeId: "attr-status-quest-1", name: "questStatus", value: "active", type: "label" },
        { attributeId: "attr-loc-quest-1", name: "location", value: "Vault Depths", type: "label" },
      ],
    }),
    buildQuest({ noteId: "quest-2", title: "Reclaim the Archive",
      attributes: [
        { attributeId: "attr-lore-quest-2", name: "lore", value: "", type: "label" },
        { attributeId: "attr-type-quest-2", name: "loreType", value: "quest", type: "label" },
        { attributeId: "attr-status-quest-2", name: "questStatus", value: "active", type: "label" },
      ],
    }),
    buildQuest({ noteId: "quest-3", title: "The Ember Treaty",
      attributes: [
        { attributeId: "attr-lore-quest-3", name: "lore", value: "", type: "label" },
        { attributeId: "attr-type-quest-3", name: "loreType", value: "quest", type: "label" },
        { attributeId: "attr-status-quest-3", name: "questStatus", value: "complete", type: "label" },
      ],
    }),
    buildQuest({ noteId: "quest-4", title: "The Fallen Gate",
      attributes: [
        { attributeId: "attr-lore-quest-4", name: "lore", value: "", type: "label" },
        { attributeId: "attr-type-quest-4", name: "loreType", value: "quest", type: "label" },
        { attributeId: "attr-status-quest-4", name: "questStatus", value: "failed", type: "label" },
      ],
    }),
  ];
  const statblocksNotes = options.statblocks ?? [
    buildStatblock({ noteId: "sb-1", title: "Cave Bear",
      attributes: [
        { attributeId: "attr-lore-sb-1", name: "lore", value: "", type: "label" },
        { attributeId: "attr-type-sb-1", name: "loreType", value: "creature", type: "label" },
        { attributeId: "attr-statblock-sb-1", name: "statblock", value: "", type: "label" },
        { attributeId: "attr-cr-sb-1", name: "challengeRating", value: "2", type: "label" },
        { attributeId: "attr-ctype-sb-1", name: "creatureType", value: "beast", type: "label" },
        { attributeId: "attr-ac-sb-1", name: "ac", value: "11", type: "label" },
        { attributeId: "attr-hp-sb-1", name: "hp", value: "42", type: "label" },
        { attributeId: "attr-spd-sb-1", name: "speed", value: "40 ft.", type: "label" },
        { attributeId: "attr-str-sb-1", name: "str", value: "20", type: "label" },
        { attributeId: "attr-dex-sb-1", name: "dex", value: "10", type: "label" },
        { attributeId: "attr-con-sb-1", name: "con", value: "16", type: "label" },
        { attributeId: "attr-int-sb-1", name: "int", value: "2", type: "label" },
        { attributeId: "attr-wis-sb-1", name: "wis", value: "13", type: "label" },
        { attributeId: "attr-cha-sb-1", name: "cha", value: "7", type: "label" },
      ],
    }),
    buildStatblock({ noteId: "sb-2", title: "Shadow Wraith",
      attributes: [
        { attributeId: "attr-lore-sb-2", name: "lore", value: "", type: "label" },
        { attributeId: "attr-type-sb-2", name: "loreType", value: "creature", type: "label" },
        { attributeId: "attr-statblock-sb-2", name: "statblock", value: "", type: "label" },
        { attributeId: "attr-cr-sb-2", name: "challengeRating", value: "5", type: "label" },
        { attributeId: "attr-ctype-sb-2", name: "creatureType", value: "undead", type: "label" },
        { attributeId: "attr-ac-sb-2", name: "ac", value: "13", type: "label" },
        { attributeId: "attr-hp-sb-2", name: "hp", value: "67", type: "label" },
        { attributeId: "attr-spd-sb-2", name: "speed", value: "40 ft. (fly)", type: "label" },
        { attributeId: "attr-str-sb-2", name: "str", value: "6", type: "label" },
        { attributeId: "attr-dex-sb-2", name: "dex", value: "14", type: "label" },
        { attributeId: "attr-con-sb-2", name: "con", value: "13", type: "label" },
        { attributeId: "attr-int-sb-2", name: "int", value: "11", type: "label" },
        { attributeId: "attr-wis-sb-2", name: "wis", value: "12", type: "label" },
        { attributeId: "attr-cha-sb-2", name: "cha", value: "14", type: "label" },
      ],
    }),
  ];
  const brainDumpHistory: HistoryEntry[] = options.brainDumpHistory ?? [
    { id: "hist-default-1", rawText: "Default captured fragments", summary: "Captured two fragments", notesCreated: ["note-1"], notesUpdated: [], model: "gpt-4o-mini", tokensUsed: 120, createdAt: new Date(Date.now() - 3_600_000).toISOString() },
  ];
  const configStatus = options.configStatus ?? {
    allcodex: { ok: true, configured: true, url: "http://localhost:8080", version: "0.92.0" },
    allknower: { ok: true, configured: true, url: "http://localhost:3001" },
  };
  const mentionSuggestions = options.mentionSuggestions ?? [
    { noteId: "mention-1", title: "Aether Keep", loreType: "location" },
    { noteId: "mention-2", title: "Aria Vale", loreType: "character" },
  ];

  const autolinkMatches = options.autolinkMatches ?? [
    { term: "Aria Vale", noteId: "note-1", title: "Aria Vale" },
    { term: "Aether Keep", noteId: "note-2", title: "Aether Keep" },
  ];

  const timelineNotes: TimelineNote[] = options.timeline ?? [
    { noteId: "tl-1", title: "Founding of Aether Keep", attributes: [
      { name: "lore", value: "", type: "label" },
      { name: "loreType", value: "event", type: "label" },
      { name: "inWorldDate", value: "Year 12, Age of Embers", type: "label" },
      { name: "era", value: "Age of Embers", type: "label" },
      { name: "description", value: "The fortress was raised on the ley breach.", type: "label" },
    ]},
    { noteId: "tl-2", title: "Aria Vale Appointed Warden", attributes: [
      { name: "lore", value: "", type: "label" },
      { name: "loreType", value: "timeline", type: "label" },
      { name: "inWorldDate", value: "Year 45, Age of Embers", type: "label" },
      { name: "era", value: "Age of Embers", type: "label" },
    ]},
  ];

  const shareTree: ShareItem[] = options.shareTree ?? [
    { noteId: "note-1", title: "Aria Vale", loreType: "character", isDraft: false, isGmOnly: false, shareAlias: "aria-vale", isProtected: false, dateModified: new Date().toISOString() },
    { noteId: "note-2", title: "Aether Keep", loreType: "location", isDraft: true, isGmOnly: false, shareAlias: null, isProtected: false, dateModified: new Date().toISOString() },
  ];

  const seedNotes = options.notes ?? [
    buildNote({
      noteId: "note-1",
      title: "Aria Vale",
      attributes: [
        { attributeId: "attr-lore-note-1", name: "lore", value: "", type: "label" },
        { attributeId: "attr-type-note-1", name: "loreType", value: "character", type: "label" },
      ],
      content: "<h1>Aria Vale</h1><p>Warden of the northern archive.</p>",
    }),
    buildNote({
      noteId: "note-2",
      title: "Aether Keep",
      attributes: [
        { attributeId: "attr-lore-note-2", name: "lore", value: "", type: "label" },
        { attributeId: "attr-type-note-2", name: "loreType", value: "location", type: "label" },
      ],
      content: "<h1>Aether Keep</h1><p>Fortress built above the ley breach.</p>",
    }),
  ];

  for (const note of seedNotes) {
    notes.set(note.noteId, structuredClone(note));
    orderedNoteIds.push(note.noteId);
  }

  await page.route("**/api/config/portal", async (route) => {
    await fulfillJson(route, { loreRootNoteId: "root" });
  });

  await page.route("**/api/share**", async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      await fulfillJson(route, { enabled: false, shareId: null, shareUrl: null });
    } else if (method === "POST" || method === "PUT") {
      await fulfillJson(route, { enabled: true, shareId: "share-123", shareUrl: "http://localhost:8080/share/share-123" });
    } else if (method === "DELETE") {
      await fulfillJson(route, { enabled: false, shareId: null, shareUrl: null });
    } else {
      await route.fallback();
    }
  });

  // Must be registered AFTER **/api/share** so LIFO routing matches /api/share/tree first
  await page.route("**/api/share/tree**", async (route) => {
    await fulfillJson(route, shareTree);
  });

  await page.route("**/api/timeline**", async (route) => {
    await fulfillJson(route, timelineNotes);
  });

  await page.route("**/api/rag", async (route) => {
    if (route.request().method() === "GET") {
      await fulfillJson(route, ragStatus);
      return;
    }

    await fulfillJson(route, { results: [] });
  });

  await page.route("**/api/lore/mention-search**", async (route) => {
    const url = new URL(route.request().url());
    const query = (url.searchParams.get("q") ?? "").replace(/^@+/, "").toLowerCase();
    const filtered = mentionSuggestions.filter((item) => item.title.toLowerCase().includes(query));
    await fulfillJson(route, filtered);
  });

  await page.route("**/api/lore/note-search**", async (route) => {
    const url = new URL(route.request().url());
    const query = (url.searchParams.get("q") ?? "").toLowerCase();
    const type = url.searchParams.get("type");

    const results = orderedNoteIds
      .map((id) => notes.get(id))
      .filter((note): note is NoteRecord => Boolean(note))
      .filter((note) => note.title.toLowerCase().includes(query))
      .filter((note) => !type || note.type === type)
      .map((note) => ({
        noteId: note.noteId,
        title: note.title,
        type: note.type,
        loreType: note.attributes.find((attribute) => attribute.name === "loreType")?.value ?? null,
      }))
      .slice(0, 12);

    await fulfillJson(route, results);
  });

  await page.route("**/api/lore/*/backlinks", async (route) => {
    const noteId = route.request().url().match(/\/api\/lore\/([^/]+)\/backlinks/)?.[1];
    const rawBacklinks = noteId ? backlinks[noteId] ?? [] : [];
    const filteredBacklinks = rawBacklinks.filter((entry) => {
      const backlinkNote = notes.get(entry.noteId);
      return entry.loreType !== null || isLoreNoteRecord(backlinkNote);
    });
    await fulfillJson(route, filteredBacklinks);
  });

  await page.route("**/api/lore/*/attributes**", async (route) => {
    const note = findNoteFromUrl(route.request().url(), notes);

    if (!note) {
      await fulfillJson(route, { error: "Not found" }, 404);
      return;
    }

    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON() as { type: Attribute["type"]; name: string; value: string };
      const attribute: Attribute = {
        attributeId: `attr-${body.name}-${note.noteId}-${note.attributes.length + 1}`,
        name: body.name,
        value: body.value,
        type: body.type,
      };
      note.attributes.push(attribute);
      note.dateModified = new Date().toISOString();
      await fulfillJson(route, attribute, 200);
      return;
    }

    if (route.request().method() === "DELETE") {
      const attrId = new URL(route.request().url()).searchParams.get("attrId");
      if (attrId) {
        note.attributes = note.attributes.filter((attribute) => attribute.attributeId !== attrId);
        note.dateModified = new Date().toISOString();
      }
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    await route.fallback();
  });

  await page.route("**/api/lore/*/breadcrumbs", async (route) => {
    const noteId = findNoteFromUrl(route.request().url(), notes)?.noteId;
    const crumbs = noteId && options.breadcrumbs?.[noteId] ? options.breadcrumbs[noteId] : [];
    await fulfillJson(route, crumbs);
  });

  await page.route("**/api/lore/*/relationships", async (route) => {
    await fulfillJson(route, { existing: [], suggestions: relationships.suggestions });
  });

  await page.route("**/api/lore/autolink", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    await fulfillJson(route, { matches: autolinkMatches });
  });

  await page.route("**/api/lore/*/preview**", async (route) => {
    const note = findNoteFromUrl(route.request().url(), notes);
    await route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: normalizePortalImageHtml(note?.content ?? ""),
    });
  });

  await page.route("**/api/lore/*/content", async (route) => {
    const note = findNoteFromUrl(route.request().url(), notes);

    if (route.request().method() === "PUT") {
      if (note) {
        note.content = await route.request().postData() ?? "";
        note.dateModified = new Date().toISOString();
      }
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    await route.fulfill({
      status: note ? 200 : 404,
      contentType: "text/html; charset=utf-8",
      body: normalizePortalImageHtml(note?.content ?? ""),
    });
  });

  await page.route("**/api/lore/upload-image", async (route) => {
    const now = new Date().toISOString();
    const noteId = `image-${orderedNoteIds.length + 1}`;
    const filename = route.request().headers()["x-vercel-filename"] ?? "portrait.png";

    notes.set(noteId, {
      noteId,
      title: filename,
      type: "image",
      dateCreated: now,
      dateModified: now,
      parentNoteIds: ["root"],
      attributes: [],
      content: "",
    });
    orderedNoteIds.unshift(noteId);

    await fulfillJson(route, { noteId, url: `/api/images/${noteId}/${encodeURIComponent(filename)}` }, 201);
  });

  await page.route("**/api/images/*/*", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const segments = pathname.split("/");
    const noteId = segments.at(-2);
    const note = noteId ? notes.get(noteId) : undefined;
    const title = note?.title ?? "Portrait";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="600" viewBox="0 0 480 600"><rect width="480" height="600" fill="#161124"/><rect x="22" y="22" width="436" height="556" rx="24" fill="#241936" stroke="#ffbf69" stroke-width="3"/><text x="240" y="305" fill="#ffbf69" font-size="42" font-family="serif" text-anchor="middle">${escapeHtml(title)}</text></svg>`;
    await route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: svg,
    });
  });

  await page.route("**/api/lore/*/image", async (route) => {
    const note = findNoteFromUrl(route.request().url(), notes);
    const title = note?.title ?? "Portrait";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="600" viewBox="0 0 480 600"><rect width="480" height="600" fill="#161124"/><rect x="22" y="22" width="436" height="556" rx="24" fill="#241936" stroke="#ffbf69" stroke-width="3"/><text x="240" y="305" fill="#ffbf69" font-size="42" font-family="serif" text-anchor="middle">${escapeHtml(title)}</text></svg>`;
    await route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: svg,
    });
  });

  await page.route("**/api/lore/*", async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;
    const noteId = pathname.split("/").at(-1) ?? "";
    const note = notes.get(noteId);
    const method = route.request().method();

    if (
      pathname.endsWith("/api/lore") ||
      pathname.endsWith("/api/lore/mention-search") ||
      pathname.endsWith("/api/lore/note-search")
    ) {
      await route.fallback();
      return;
    }

    if (method === "GET") {
      await fulfillJson(route, note ? serializeNote(note, notes) : { error: "Not found" }, note ? 200 : 404);
      return;
    }

    if (method === "PATCH") {
      const body = route.request().postDataJSON() as { title?: string };
      if (note && body.title) {
        note.title = body.title;
        note.dateModified = new Date().toISOString();
      }
      await fulfillJson(route, note ? serializeNote(note, notes) : { error: "Not found" }, note ? 200 : 404);
      return;
    }

    if (method === "DELETE") {
      if (note) {
        notes.delete(noteId);
        const index = orderedNoteIds.indexOf(noteId);
        if (index >= 0) orderedNoteIds.splice(index, 1);
      }
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    await route.fallback();
  });

  await page.route("**/api/lore**", async (route) => {
    const request = route.request();
    const method = request.method();
    const pathname = new URL(request.url()).pathname;

    if (!pathname.endsWith("/api/lore")) {
      await route.fallback();
      return;
    }

    if (method === "GET") {
      const url = new URL(request.url());
      const q = url.searchParams.get("q") ?? "#lore";
      const result = filterNotes(q, orderedNoteIds.map((id) => notes.get(id)!).filter(Boolean));
      await fulfillJson(route, result.map((note) => serializeNote(note, notes)));
      return;
    }

    if (method === "POST") {
      const body = request.postDataJSON() as {
        title: string;
        loreType?: string;
        content?: string;
        attributes?: Record<string, string>;
      };

      const noteId = `note-${orderedNoteIds.length + 1}`;
      const createdAt = new Date().toISOString();
      const attributes: Attribute[] = [
        { attributeId: `attr-lore-${noteId}`, name: "lore", value: "", type: "label" },
        { attributeId: `attr-type-${noteId}`, name: "loreType", value: body.loreType ?? "lore", type: "label" },
      ];

      for (const [key, value] of Object.entries(body.attributes ?? {})) {
        if (value.trim()) {
          attributes.push({
            attributeId: `attr-${key}-${noteId}`,
            name: key.replace(/\s+/g, "_"),
            value,
            type: "label",
          });
        }
      }

      const note: NoteRecord = {
        noteId,
        title: body.title,
        type: "text",
        dateCreated: createdAt,
        dateModified: createdAt,
        parentNoteIds: ["root"],
        attributes,
        content: body.content && body.content.trim() ? body.content : `<h1>${escapeHtml(body.title)}</h1><p>New lore entry.</p>`,
      };

      notes.set(noteId, note);
      orderedNoteIds.unshift(noteId);

      await fulfillJson(route, { note: { noteId } }, 201);
      return;
    }

    await route.fallback();
  });

  await page.route("**/api/search**", async (route) => {
    const url = new URL(route.request().url());
    const query = (url.searchParams.get("q") ?? "").toLowerCase();
    const filtered = query
      ? searchResults.filter((r) => r.title.toLowerCase().includes(query) || (r.snippet ?? "").toLowerCase().includes(query))
      : searchResults;
    await fulfillJson(route, filtered);
  });

  await page.route("**/api/quests", async (route) => {
    await fulfillJson(route, questsNotes.map((note) => serializeNote(note, notes)));
  });

  await page.route("**/api/statblocks", async (route) => {
    await fulfillJson(route, statblocksNotes.map((note) => serializeNote(note, notes)));
  });

  await page.route("**/api/config/status**", async (route) => {
    await fulfillJson(route, configStatus);
  });

  await page.route("**/api/integrations/allcodex/connect", async (route) => {
    await fulfillJson(route, { success: true });
  });

  await page.route("**/api/integrations/allcodex", async (route) => {
    if (route.request().method() === "DELETE") {
      await fulfillJson(route, { success: true });
      return;
    }
    await route.fallback();
  });

  await page.route("**/api/config/allknower-login", async (route) => {
    await fulfillJson(route, { success: true });
  });

  await page.route("**/api/auth/login", async (route) => {
    await fulfillJson(route, { ok: true });
  });

  await page.route("**/api/auth/register", async (route) => {
    await fulfillJson(route, { ok: true });
  });

  await page.route("**/api/config/disconnect**", async (route) => {
    await fulfillJson(route, { success: true });
  });

  await page.route("**/api/import/azgaar**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("action") === "preview") {
      await fulfillJson(route, {
        mapName: "Test Realm",
        stateCount: 3,
        burgCount: 12,
        religionCount: 2,
        cultureCount: 4,
        noteCount: 1,
      });
      return;
    }
    await fulfillJson(route, {
      mapName: "Test Realm",
      totals: { created: 22, skipped: 0, errors: 0 },
      states: { created: [{ noteId: "s-1", name: "Ironmark" }], skipped: [], errors: [] },
      burgs: { created: [{ noteId: "b-1", name: "Ashgate" }], skipped: [], errors: [] },
      religions: { created: [{ noteId: "r-1", name: "The Ember Creed" }], skipped: [], errors: [] },
      cultures: { created: [{ noteId: "c-1", name: "Velthari" }], skipped: [], errors: [] },
      notes: { created: [], skipped: [], errors: [] },
    });
  });

  await page.route("**/api/import/system-pack", async (route) => {
    await fulfillJson(route, {
      created: 2,
      skipped: 0,
      errors: 0,
      detail: {
        created: [{ noteId: "sp-1", name: "Goblin" }, { noteId: "sp-2", name: "Orc" }],
        skipped: [],
        errors: [],
      },
    });
  });

  // SSE streaming endpoint — auto mode uses this
  await page.route("**/api/brain-dump/stream", async (route) => {
    if (brainDump.status && brainDump.status !== 200) {
      await fulfillJson(route, brainDump.body, brainDump.status);
      return;
    }
    if (brainDump.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, brainDump.delayMs));
    }
    const resultJson = JSON.stringify(brainDump.body);
    await fulfillSSE(route, [
      { event: "status", data: { type: "status", stage: "rag", message: "Searching lore..." } },
      { event: "status", data: { type: "status", stage: "llm", message: "Analyzing with AI..." } },
      { event: "token", data: { type: "token", content: resultJson.slice(0, 20) } },
      { event: "done", data: { type: "done", raw: resultJson, tokensUsed: 100, model: "mock", latencyMs: 150 } },
    ]);
  });

  // Non-streaming brain-dump (review/commit modes)
  await page.route("**/api/brain-dump", async (route) => {
    const url = route.request().url();
    if (url.includes("/stream") || url.includes("/history")) {
      await route.fallback();
      return;
    }
    if (brainDump.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, brainDump.delayMs));
    }
    await fulfillJson(route, brainDump.body, brainDump.status ?? 200);
  });

  await page.route("**/api/brain-dump/history**", async (route) => {
    await fulfillJson(route, { items: brainDumpHistory, hasMore: false });
  });

  await page.route("**/api/ai/relationships", async (route) => {
    const method = route.request().method();
    if (method === "PUT") {
      const body = JSON.parse(route.request().postData() || "{}");
      const relations = body.relations ?? [];
      await fulfillJson(route, {
        applied: relations.map((rel: Record<string, string>) => ({
          sourceNoteId: body.sourceNoteId ?? "unknown",
          targetNoteId: rel.targetNoteId ?? "unknown",
          relationshipType: rel.relationshipType ?? "unknown",
          relationName: rel.relationshipType ?? "unknown",
        })),
        skipped: [],
        failed: [],
      });
      return;
    }

    await fulfillJson(route, { suggestions: relationships.suggestions });
  });

  await page.route("**/api/ai/gaps", async (route) => {
    await fulfillJson(route, gaps.body, gaps.status ?? 200);
  });

  await page.route("**/api/ai/consistency", async (route) => {
    await fulfillJson(route, consistency.body, consistency.status ?? 200);
  });

  return {
    getNote(noteId: string) {
      return notes.get(noteId);
    },
    upsertNote(note: NoteRecord) {
      notes.set(note.noteId, structuredClone(note));
      if (!orderedNoteIds.includes(note.noteId)) {
        orderedNoteIds.unshift(note.noteId);
      }
    },
  };
}

function filterNotes(query: string, notes: NoteRecord[]) {
  const normalized = query.toLowerCase();

  return notes.filter((note) => {
    if (normalized.includes("#loretype=character")) {
      return note.attributes.some((attribute) => attribute.name === "loreType" && attribute.value === "character");
    }

    if (normalized === "#lore") {
      return note.attributes.some((attribute) => attribute.name === "lore");
    }

    return note.title.toLowerCase().includes(normalized.replace("#lore", "").trim());
  });
}

function serializeNote(note: NoteRecord, notes: Map<string, NoteRecord>) {
  const portraitImageNoteId = note.attributes.find(
    (attribute) => attribute.type === "relation" && ["portraitImage", "coverImage", "portrait", "heroImage"].includes(attribute.name),
  )?.value ?? null;

  const resolvedRelations = note.attributes
    .filter(
      (attribute) =>
        attribute.type === "relation" &&
        attribute.name !== "template" &&
        !["portraitImage", "coverImage", "portrait", "heroImage"].includes(attribute.name),
    )
    .map((attribute) => {
      const target = notes.get(attribute.value);
      return {
        name: attribute.name,
        targetNoteId: attribute.value,
        targetTitle: target?.title ?? attribute.value,
        loreType: target?.attributes.find((candidate) => candidate.name === "loreType")?.value ?? null,
      };
    });

  return {
    noteId: note.noteId,
    title: note.title,
    type: note.type,
    dateCreated: note.dateCreated,
    dateModified: note.dateModified,
    attributes: note.attributes,
    parentNoteIds: note.parentNoteIds,
    portraitImageNoteId,
    resolvedRelations,
  };
}

function findNoteFromUrl(url: string, notes: Map<string, NoteRecord>) {
  const pathname = new URL(url).pathname;
  const segments = pathname.split("/");
  const loreIndex = segments.findIndex((segment) => segment === "lore");
  if (loreIndex === -1 || loreIndex + 1 >= segments.length) {
    return undefined;
  }

  return notes.get(segments[loreIndex + 1]);
}

/**
 * Fulfill a Playwright route with a JSON response constructed from the provided body and status.
 *
 * @param route - The Playwright route to fulfill
 * @param body - The value to serialize as the JSON response body
 * @param status - HTTP status code to return (defaults to 200)
 */
async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

/**
 * Formats a single Server-Sent Events (SSE) event line sequence.
 *
 * @param event - The SSE event name
 * @param data - The event payload; will be JSON-stringified
 * @returns An SSE-formatted string containing an `event:` line and a `data:` line terminated by a blank line
 */
function sseEncode(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Fulfills the Playwright route with a Server-Sent Events (SSE) response built from the provided events.
 *
 * @param route - The Playwright Route to fulfill
 * @param events - An array of SSE event objects; each item must have an `event` name and a `data` payload which will be JSON-stringified for the `data:` line
 */
async function fulfillSSE(route: Route, events: Array<{ event: string; data: unknown }>) {
  const body = events.map(e => sseEncode(e.event, e.data)).join("");
  await route.fulfill({
    status: 200,
    contentType: "text/event-stream",
    body,
  });
}

/**
 * Escape HTML special characters in a string.
 *
 * @param value - The input string to escape
 * @returns The input string with `&`, `<`, `>`, `"` and `'` replaced by their corresponding HTML entities
 */
function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
