# CLAUDE.md — AllCodex Portal

Next.js 16 App Router frontend. Bun runtime. The only user-facing surface in the AllCodex ecosystem.

## Development Commands

```bash
bun install
bun dev                    # dev on :3000
bun build                  # production build
bun run check              # tsc --noEmit && vitest run (excludes Playwright)
bun run test:e2e           # Playwright E2E (needs full stack: Core :8080 + AllKnower :3001)
```

## Coding Conventions

- Next.js App Router + React Compiler; `@/*` path alias
- TanStack Query for server state; Zustand (`useBrainDumpStore`, `useAIToolsStore`, `useCopilotStore`) for shared UI state
- `lib/` is server-only — never import from client components
- `components/ui/` = generic shadcn primitives, `components/portal/` = app-specific
- API routes are thin proxies — no domain logic in the portal
- Theme supports light (parchment) and dark (grimoire) via `next-themes` — `ThemeProvider` in `components/providers.tsx`; `.dark` class activates the dark token block in `globals.css`
- All raw HTML rendering in React must be sanitized via `sanitizeLoreHtml()` from `lib/sanitize.ts` (DOMPurify) — player-safe previews use `sanitizePlayerView()`
- Tailwind CSS 4 with shadcn/ui (new-york style, neutral base, CSS variables)

## Key Files

| What | Where |
|---|---|
| Portal layout | `app/(portal)/layout.tsx` |
| AllKnower proxy lib | `lib/allknower-server.ts` |
| ETAPI proxy lib (→ Core) | `lib/etapi-server.ts` |
| Credential resolver | `lib/get-creds.ts` |
| HTML sanitizer | `lib/sanitize.ts` |
| AllKnower Zod schemas | `lib/allknower-schemas.ts` |
| Zustand stores | `lib/stores/brain-dump-store.ts`, `lib/stores/ai-tools-store.ts`, `lib/stores/copilot-store.ts` |
| Playwright config | `playwright.config.ts` |
| Integration test setup | `tests/helpers/global-setup.ts` |

## Testing

### Unit Tests (Vitest)

```bash
bun run check              # typecheck + vitest run
```

~180 unit tests across 7 files in `lib/*.test.ts`. Fast, no external deps.

### E2E Tests (Playwright)

```bash
bun run test:e2e           # needs full stack running
```

~150 test cases across 28 spec files in `tests/*.spec.ts`, running on chromium/firefox/webkit. `bun run check` intentionally excludes Playwright — E2E needs AllKnower (:3001) and AllCodex Core (:8080) live. Playwright auto-starts the dev server.

### Integration Tests (Playwright, real LLMs)

```bash
npx playwright test --project=integration
```

3 specs in `tests/integration/*.spec.ts` that hit real LLMs via OpenRouter. Requires `.env.test`:
```
TEST_OPENROUTER_API_KEY=...
TEST_ALLKNOWER_URL=http://localhost:3001
TEST_ALLCODEX_URL=http://localhost:8080
TEST_ALLCODEX_ETAPI_TOKEN=...
```

Global setup (`tests/helpers/global-setup.ts`) auto-provisions a test account, signs in, connects AllCodex Core, and writes `tests/helpers/.auth/storage-state.json` with session cookies.

## Common Pitfalls

1. **Zod schemas must match AllKnower source**: when writing or updating `allknower-schemas.ts`, cross-reference `allknower/src/pipeline/schemas/response-schemas.ts` — mismatches cause false 502s at runtime.
2. **Brain dump E2E fixtures need unique runtime IDs**: AllKnower's dedup logic treats content matching existing lore as an update attempt, not a new note. Embed `Date.now()` in both the entity name and body, and include explicit "do not merge" instructions — thematic similarity alone (e.g. reusing "fortress" or "observatory" across runs) can trigger dedup even with unique IDs.
3. **`autoRelate` latency scales with entity count**: `suggestRelationsForNote` runs once per created note (~30-40s each). Keep integration test brain-dump fixtures to 1 entity to stay under timeout ceilings.
4. **`lib/` is server-only**: importing from `lib/` in a client component causes build failures. Use API routes to proxy server-side calls.
