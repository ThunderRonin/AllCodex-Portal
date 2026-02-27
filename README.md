# AllCodex Portal

A web portal for [AllCodex](https://github.com/ThunderRonin/AllCodex) (a customized TriliumNext instance) and [AllKnower](https://github.com/ThunderRonin/AllKnower), the AI knowledge service that powers it. Built with Next.js 16, shadcn/ui, and TanStack Query.

The portal gives you a clean interface for browsing lore, running brain dumps, and using AI tools — without opening the full AllCodex desktop app.

## Features

- **Lore Browser** — browse, create, and edit notes tagged with `#lore` in AllCodex
- **Brain Dump** — paste raw worldbuilding thoughts and let AllKnower extract and file entities automatically
- **AI Tools** — consistency checker, lore gap detector, and relationship suggestions powered by AllKnower
- **Semantic Search** — RAG-based search across your lore using AllKnower's vector index, plus direct ETAPI label queries
- **Settings** — connect to AllCodex via ETAPI token or password login, and AllKnower via bearer token or sign-in

## Requirements

- [AllCodex](https://github.com/ThunderRonin/AllCodex) running and accessible (ETAPI enabled)
- [AllKnower](https://github.com/ThunderRonin/AllKnower) running for AI features
- Node.js 20+ or Bun

## Getting Started

```bash
bun install
bun dev
```

Open [http://localhost:3000](http://localhost:3000) and go to Settings to connect to AllCodex and AllKnower. Credentials are stored as HTTP-only cookies — no `.env` required, though env vars work as a fallback.

### Environment variables (optional)

If you prefer env vars over the Settings UI, create a `.env.local`:

```env
ALLCODEX_URL=http://localhost:8080
ALLCODEX_ETAPI_TOKEN=your_token_here
ALLKNOWER_URL=http://localhost:3001
ALLKNOWER_BEARER_TOKEN=your_token_here
```

Cookie-based settings take priority when present.

## Project Structure

```
app/
  (portal)/         # All portal pages
    page.tsx        # Dashboard
    lore/           # Lore browser, detail, create, edit
    brain-dump/     # Brain dump input and history
    ai/             # Consistency, relationships, gap detector
    search/         # Semantic and label search
    settings/       # Service connection config
  api/              # Next.js API routes (proxy to AllCodex/AllKnower)
components/
  portal/           # App-specific components (sidebar, banners)
  ui/               # shadcn/ui components
lib/
  etapi-server.ts   # AllCodex ETAPI client (server-only)
  allknower-server.ts  # AllKnower API client (server-only)
  get-creds.ts      # Resolves credentials from cookies or env
```

## Building for Production

```bash
bun run build
bun start
```

## Contributing

Contributions are welcome. If you find a bug or want to add something, open an issue first so we can discuss the approach before you write any code.

A few things to keep in mind:

- The API routes in `app/api/` are thin proxies. Heavy logic belongs in AllKnower, not here.
- `lib/etapi-server.ts` and `lib/allknower-server.ts` are server-only. Never import them in client components.
- Keep new UI components in `components/portal/` and use the existing shadcn primitives in `components/ui/` rather than adding new UI libraries.
- Credentials must never be logged or exposed to the client.

To run locally during development, you need AllCodex and AllKnower both running. The portal will show service banners for any features that require a service that isn't connected.

