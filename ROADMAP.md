# AllCodex Portal — Feature Roadmap

> Implementation plan for remaining features, derived from the original AllCodex plan.
> All work is scoped to the AllCodex-Portal Next.js app.

---

## Feature 1: Lore Root Note Configuration

**Problem:** When creating lore entries via the portal, `parentNoteId` defaults to `"root"`. Users need to set a dedicated lore folder in AllCodex as the default parent so new entries land in the right place.

**Current state:**
- `app/api/lore/route.ts` POST handler hardcodes fallback: `if (!noteParams.parentNoteId) noteParams.parentNoteId = "root";`
- Settings page (`app/(portal)/settings/page.tsx`) only has AllCodex and AllKnower connection cards — no portal-level config
- Credentials are stored as HTTP-only cookies via `app/api/config/connect/route.ts`

**Implementation:**

### 1a. Add a "Portal Config" section to Settings

**File:** `app/(portal)/settings/page.tsx`

- Add a third card below the AllCodex/AllKnower connection cards titled "Portal Configuration"
- Contains a single input field: **Lore Root Note ID**
  - Text input with placeholder "root" and a description: "The AllCodex note ID where new lore entries will be created. Leave empty to use the Trilium root."
  - A "Browse" button is nice-to-have (would search `#loreRoot` label), but v1 can be a plain text input
  - Save button stores the value via a new cookie `lore_root_note_id`

### 1b. Add API route to save/read portal config

**New file:** `app/api/config/portal/route.ts`

- `GET` — reads `lore_root_note_id` cookie (and any future portal config), returns JSON
- `PUT` — sets `lore_root_note_id` cookie with same `COOKIE_OPTS` as connect route

### 1c. Add helper to read lore root

**File:** `lib/get-creds.ts`

- Add: `export async function getLoreRootNoteId(): Promise<string>` — reads cookie `lore_root_note_id`, falls back to env `LORE_ROOT_NOTE_ID`, falls back to `"root"`

### 1d. Use the config in lore creation

**File:** `app/api/lore/route.ts`

- Import `getLoreRootNoteId`
- Replace hardcoded `"root"` with `await getLoreRootNoteId()`

### 1e. Show lore root in "New Lore Entry" form

**File:** `app/(portal)/lore/new/page.tsx`

- Pre-populate the "Parent Note ID" field by fetching `/api/config/portal` on mount
- User can still override per-entry

**Estimated files changed:** 4 modified, 1 new

---

## Feature 2: Lore Entry Promoted Attributes (Create & Edit)

**Problem:** AllCodex templates define promoted attributes (fullName, race, age, affiliation, etc.) but the portal's create/edit forms only handle title, content, and loreType. Notes created via the portal have no structured fields.

**Current state:**
- `app/(portal)/lore/new/page.tsx` — has title, type selector, parent ID, content textarea
- `app/(portal)/lore/[id]/edit/page.tsx` — has title and raw HTML content textarea only
- `app/api/lore/route.ts` POST — creates note, sets `#lore` and `#loreType` labels
- `lib/etapi-server.ts` — `createAttribute()` already exists
- The detail page (`[id]/page.tsx`) already reads and displays attributes in the sidebar

**Implementation:**

### 2a. Define promoted field schema per lore type

**New file:** `lib/lore-fields.ts`

```ts
export interface LoreField {
  name: string;        // attribute name in Trilium (e.g. "fullName")
  label: string;       // display label (e.g. "Full Name")
  type: "text" | "number" | "textarea";
  placeholder?: string;
}

export const LORE_TYPE_FIELDS: Record<string, LoreField[]> = {
  character: [
    { name: "fullName", label: "Full Name", type: "text", placeholder: "e.g. Aldric Stonehaven" },
    { name: "aliases", label: "Aliases", type: "text", placeholder: "Comma-separated" },
    { name: "age", label: "Age", type: "number" },
    { name: "race", label: "Race", type: "text" },
    { name: "gender", label: "Gender", type: "text" },
    { name: "affiliation", label: "Affiliation", type: "text" },
    { name: "role", label: "Role", type: "text" },
    { name: "status", label: "Status", type: "text", placeholder: "alive, dead, unknown" },
  ],
  location: [
    { name: "locationType", label: "Type", type: "text", placeholder: "City, fortress, forest…" },
    { name: "region", label: "Region", type: "text" },
    { name: "population", label: "Population", type: "number" },
    { name: "ruler", label: "Ruler", type: "text" },
  ],
  faction: [
    { name: "factionType", label: "Type", type: "text", placeholder: "Guild, kingdom, order…" },
    { name: "leader", label: "Leader", type: "text" },
    { name: "foundingDate", label: "Founded", type: "text" },
    { name: "goals", label: "Goals", type: "textarea" },
  ],
  creature: [
    { name: "creatureType", label: "Type", type: "text", placeholder: "Beast, undead, dragon…" },
    { name: "habitat", label: "Habitat", type: "text" },
    { name: "diet", label: "Diet", type: "text" },
    { name: "dangerLevel", label: "Danger Level", type: "number" },
    { name: "abilities", label: "Abilities", type: "textarea" },
  ],
  event: [
    { name: "inWorldDate", label: "In-World Date", type: "text" },
    { name: "outcome", label: "Outcome", type: "text" },
    { name: "consequences", label: "Consequences", type: "textarea" },
  ],
  manuscript: [
    { name: "genre", label: "Genre", type: "text" },
    { name: "manuscriptStatus", label: "Status", type: "text", placeholder: "draft, in-progress, complete" },
    { name: "wordCount", label: "Word Count", type: "number" },
  ],
  item: [
    { name: "itemType", label: "Type", type: "text", placeholder: "Weapon, artifact, potion…" },
    { name: "rarity", label: "Rarity", type: "text" },
    { name: "owner", label: "Current Owner", type: "text" },
    { name: "properties", label: "Properties", type: "textarea" },
  ],
};
```

### 2b. Build a reusable `<PromotedFields>` component

**New file:** `components/portal/PromotedFields.tsx`

- Props: `loreType: string`, `values: Record<string, string>`, `onChange: (name, value) => void`, `disabled?: boolean`
- Looks up `LORE_TYPE_FIELDS[loreType]`, renders a grid of inputs/textareas
- Returns nothing if no fields defined for the type (e.g. "General Lore")
- Appears below the type selector on both create and edit forms

### 2c. Wire into New Lore page

**File:** `app/(portal)/lore/new/page.tsx`

- Add state: `const [attributes, setAttributes] = useState<Record<string, string>>({})`
- Render `<PromotedFields>` below the type/parent grid, driven by `loreType`
- Reset attributes when `loreType` changes
- Pass `attributes` in the POST body alongside existing fields

### 2d. Wire into Edit Lore page

**File:** `app/(portal)/lore/[id]/edit/page.tsx`

- Fetch the note's existing attributes and pre-populate
- Render `<PromotedFields>` below the title field
- On save, PATCH existing attributes or create new ones via a new API endpoint

### 2e. API route updates

**File:** `app/api/lore/route.ts` (POST)

- Destructure `attributes` from body
- After creating the note and setting labels, loop through `attributes` and call `createAttribute()` for each

**New file:** `app/api/lore/[id]/attributes/route.ts`

- `PUT` — accepts `{ attributes: Record<string, string> }`, diffs against existing note attributes, creates/updates via ETAPI

**File:** `lib/etapi-server.ts`

- Add `patchAttribute(creds, attrId, { value })` function for updating existing attributes

**Estimated files changed:** 3 modified, 3 new

---

## Feature 3: Edit Page Parity

**Problem:** The edit page only allows editing title and raw HTML content. It should match the create page's capabilities: lore type, promoted attributes, and a better content editing experience.

**Current state:**
- `app/(portal)/lore/[id]/edit/page.tsx` — bare title + raw HTML textarea + delete button

**Implementation:**

### 3a. Add lore type display/change

- Read the note's `loreType` attribute on load
- Show a `<Select>` for lore type (same as create page)
- Changing type updates the `loreType` label attribute on save

### 3b. Add promoted fields

- Import `<PromotedFields>` from Feature 2
- Pre-populate from existing note attributes
- On save, PUT to `/api/lore/[id]/attributes`

### 3c. Improve content editing

- The raw HTML textarea is functional but rough. Two options:
  - **v1 (minimal):** Keep the textarea but add a "Preview" toggle that renders the HTML in a `lore-content` div — so users can see what they're editing
  - **v2 (future):** Integrate a lightweight WYSIWYG editor (e.g. TipTap) — out of scope for initial implementation

### 3d. Content preview panel

- Add a tabs component: "Edit" | "Preview"
- Edit tab = existing textarea
- Preview tab = `<div className="lore-content" dangerouslySetInnerHTML={{ __html: content }} />`
- Uses the same CSS as the detail page so WYSIWYG appearance is guaranteed

**Estimated files changed:** 1 heavily modified (`[id]/edit/page.tsx`), depends on Feature 2 components

---

## Feature 4: Rendered Lore Content View

**Problem:** The detail page uses `dangerouslySetInnerHTML` to render raw HTML from AllCodex. This works but could be improved with sanitization and better typography.

**Current state:**
- `app/(portal)/lore/[id]/page.tsx` wraps content in `<div className="lore-content" dangerouslySetInnerHTML={{ __html: content }} />`
- `globals.css` has basic `.lore-content` styles (headings, paragraphs, lists, tables, blockquotes)

**Implementation:**

### 4a. Sanitize HTML content

**File:** `app/(portal)/lore/[id]/page.tsx` (or a shared utility)

- Install `dompurify` (or `isomorphic-dompurify` for SSR compatibility)
- Sanitize the HTML before rendering to prevent XSS from Trilium content
- Allow: standard HTML elements, classes, inline styles (Trilium's CKEditor output is rich)
- Strip: script tags, event handlers, iframes

### 4b. Enhance `.lore-content` CSS

**File:** `app/globals.css`

- Add styles for:
  - `img` — responsive images with rounded corners and max-width
  - `hr` — grimoire-style dividers
  - `code` / `pre` — styled code blocks
  - `figure` / `figcaption` — image captions
  - Nested lists — proper indentation
  - CKEditor-specific class compatibility (`.ck-content`, `.todo-list`, etc.)

### 4c. Table of Contents generation (optional enhancement)

- Parse the rendered HTML for `h1`/`h2`/`h3` elements
- Generate a small floating ToC on the left side of long entries
- Only show when content exceeds a certain height threshold

**Estimated files changed:** 2 modified, 1 dependency added

---

## Feature 5: Brain Dump History Detail

**Problem:** History entries in the brain dump page show a truncated preview and basic stats, but clicking one does nothing. Users can't see the full input text, the parsed entities, or navigate to the created/updated notes.

**Current state:**
- `app/(portal)/brain-dump/page.tsx` — history list renders `entry.rawText.slice(0, 120)`, `notesCreated`, `notesUpdated`, `model`, `tokensUsed`
- `BrainDumpHistoryEntry` interface has: `id`, `rawText`, `notesCreated` (number), `notesUpdated` (number), `model`, `tokensUsed`, `createdAt`
- The AllKnower backend stores `parsedJson` (entities + summary) and `notesCreated`/`notesUpdated` as **arrays of note IDs** in the DB, but the portal's interface only types them as numbers

### Key issue: AllKnower's API response shape

The AllKnower backend (`BrainDumpHistory` Prisma model) stores:
- `notesCreated: String[]` — array of note IDs
- `notesUpdated: String[]` — array of note IDs
- `parsedJson: Json` — the full `{ entities, summary }` parsed output

But the portal's `BrainDumpHistoryEntry` interface maps these to `notesCreated: number` and `notesUpdated: number`. Either:
- AllKnower's history endpoint is transforming arrays → counts, OR
- The portal is receiving the full arrays but only typed for counts

**This needs investigation.** Check AllKnower's `GET /brain-dump/history` and `GET /brain-dump/history/:id` endpoints.

**Implementation:**

### 5a. Add a history detail endpoint to AllKnower (if it doesn't exist)

If AllKnower doesn't have `GET /brain-dump/history/:id`, it needs one that returns:
```json
{
  "id": "...",
  "rawText": "full text...",
  "parsedJson": { "entities": [...], "summary": "..." },
  "notesCreated": ["noteId1", "noteId2"],
  "notesUpdated": ["noteId3"],
  "model": "...",
  "tokensUsed": 1234,
  "createdAt": "..."
}
```

### 5b. Add portal API route for history detail

**New file:** `app/api/brain-dump/history/[id]/route.ts`

- `GET` — proxies to AllKnower's `GET /brain-dump/history/:id`
- Returns the full history entry with parsed JSON and note ID arrays

### 5c. Add AllKnower client function

**File:** `lib/allknower-server.ts`

- Add: `export async function getBrainDumpEntry(creds, id): Promise<BrainDumpDetailEntry>`
- Define `BrainDumpDetailEntry` with full `parsedJson`, `notesCreated: string[]`, `notesUpdated: string[]`

### 5d. Build history detail page or drawer

**Option A — Dedicated page (recommended):**

**New file:** `app/(portal)/brain-dump/[id]/page.tsx`

- Full-width layout showing:
  - **Header:** date, model, token count
  - **Raw Text:** the full brain dump input in a styled blockquote
  - **Summary:** the AI-generated summary
  - **Entities:** card grid of each entity with: title, type, action (created/updated), and a link to the lore entry
  - **Back button** to brain dump page

**Option B — Drawer/dialog (lighter):**

- Click a history entry → opens a Sheet/Drawer with the same content
- Avoids a new route but can feel cramped for long dumps

### 5e. Make history entries clickable

**File:** `app/(portal)/brain-dump/page.tsx`

- Wrap each history entry in a `<Link href={/brain-dump/${entry.id}}>` (or onClick for drawer)
- Add visual affordance (hover arrow, cursor pointer)

### 5f. Add sidebar nav entry (if using dedicated page)

**File:** `components/portal/AppSidebar.tsx`

- No change needed — the `[id]` route is a child of `/brain-dump` and doesn't need its own nav entry

**Estimated files changed:** 2 modified, 2-3 new

---

## Feature 6: Azgaar FMG Import

**Problem:** Users with Azgaar Fantasy Map Generator exports should be able to bulk-import locations into AllCodex. The AllKnower plan describes this as a pipeline, but the trigger UI lives in the portal.

**Current state:** No import functionality exists anywhere.

**Implementation:**

### 6a. Understand Azgaar JSON format

Azgaar exports a `.map` file (compressed JSON) or a raw JSON with:
- `pack.burgs[]` — settlements: `{ i, name, cell, x, y, state, feature, capital, port, population, type, citadel, plaza, walls, shanty }`
- `pack.states[]` — kingdoms/nations: `{ i, name, form, color, capital, ... }`
- `pack.provinces[]` — provinces
- `pack.rivers[]` — rivers
- `pack.religions[]` — religions

### 6b. Build import API route on AllKnower side

This should be an AllKnower endpoint (e.g. `POST /import/azgaar`) since it needs to:
- Parse the Azgaar JSON
- Create notes via ETAPI with proper templates
- Set `#lore`, `#loreType=location`, and promoted attributes
- Optionally set `#geolocation` for map coordinates
- Index new notes in LanceDB

**Portal's role is UI only** — upload the file and call AllKnower.

### 6c. Add portal API proxy

**New file:** `app/api/import/azgaar/route.ts`

- `POST` — accepts `multipart/form-data` with the Azgaar JSON file
- Forwards to AllKnower's `POST /import/azgaar`
- Returns the import result (notes created, errors)

### 6d. Build import UI page

**New file:** `app/(portal)/import/page.tsx`

- Drag-and-drop file upload zone
- Preview panel: after parsing the JSON client-side, show a table of burgs/states that will be imported
- Checkboxes to select which entity types to import (burgs, states, rivers, religions)
- "Import" button triggers the API call
- Progress/result display showing created note links

### 6e. Add sidebar nav entry

**File:** `components/portal/AppSidebar.tsx`

- Add to the "Studio" group: `{ href: "/import", icon: Upload, label: "Import" }`

### 6f. Add AllKnower client function

**File:** `lib/allknower-server.ts`

- Add: `export async function importAzgaar(creds, file): Promise<ImportResult>`

**Estimated files changed:** 2 modified, 2-3 new (portal side) + AllKnower backend work

---

## Priority Order

| Priority | Feature | Complexity | Impact |
|----------|---------|------------|--------|
| **P0** | 1. Lore Root Note Config | Low | Fixes note organization — currently everything lands in root |
| **P1** | 2. Promoted Attributes (Create/Edit) | Medium | Core value — structured worldbuilding data |
| **P1** | 3. Edit Page Parity | Medium | Depends on Feature 2 — ship together |
| **P2** | 4. Rendered Content View | Low | Polish — sanitization + better CSS |
| **P2** | 5. Brain Dump History Detail | Medium | Visibility — see what AI produced |
| **P3** | 6. Azgaar FMG Import | High | Requires AllKnower backend work first |

**Recommended implementation order:** 1 → 2+3 (together) → 4 → 5 → 6

---

## Files Summary

### New files
| File | Feature | Purpose |
|------|---------|---------|
| `lib/lore-fields.ts` | 2 | Promoted field definitions per lore type |
| `components/portal/PromotedFields.tsx` | 2 | Reusable promoted fields form component |
| `app/api/config/portal/route.ts` | 1 | GET/PUT portal-level config (lore root) |
| `app/api/lore/[id]/attributes/route.ts` | 2 | PUT promoted attributes on existing notes |
| `app/api/brain-dump/history/[id]/route.ts` | 5 | Proxy to AllKnower history detail |
| `app/(portal)/brain-dump/[id]/page.tsx` | 5 | Brain dump history detail page |
| `app/api/import/azgaar/route.ts` | 6 | Proxy Azgaar file to AllKnower |
| `app/(portal)/import/page.tsx` | 6 | Azgaar import UI |

### Modified files
| File | Features | Changes |
|------|----------|---------|
| `app/(portal)/settings/page.tsx` | 1 | Add "Portal Configuration" card |
| `app/(portal)/lore/new/page.tsx` | 1, 2 | Pre-populate parent ID, add promoted fields |
| `app/(portal)/lore/[id]/edit/page.tsx` | 2, 3 | Add lore type, promoted fields, content preview |
| `app/(portal)/lore/[id]/page.tsx` | 4 | Sanitize HTML |
| `app/(portal)/brain-dump/page.tsx` | 5 | Make history entries clickable |
| `app/api/lore/route.ts` | 1, 2 | Use configured lore root, save attributes |
| `app/globals.css` | 4 | Enhanced `.lore-content` styles |
| `lib/get-creds.ts` | 1 | Add `getLoreRootNoteId()` |
| `lib/etapi-server.ts` | 2 | Add `patchAttribute()` |
| `lib/allknower-server.ts` | 5, 6 | Add history detail + Azgaar import functions |
| `components/portal/AppSidebar.tsx` | 6 | Add Import nav entry |

### Dependencies to add
| Package | Feature | Purpose |
|---------|---------|---------|
| `isomorphic-dompurify` | 4 | HTML sanitization for rendered lore content |
