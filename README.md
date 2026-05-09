# Vacanta — vacation finder

Personal vacation finder for Bogdan. Given destination countries, a date window,
trip duration, passengers, and filters, finds the **5 cheapest flight + hotel
combinations** using Ryanair routes from Bucharest plus Hotellook pricing.

This is a single-user, localhost-only Next.js app. Saved searches live in a local
SQLite file at `data/vacation-finder.db`. There is no auth.

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind v4 + shadcn-style components (manually scaffolded — registry was gated)
- SQLite via better-sqlite3 + Drizzle ORM
- Ryanair via `@2bad/ryanair`
- Hotellook via Travelpayouts API (with a local mock fallback)
- Anthropic SDK for the in-app chat assistant
- Native `Response` + `ReadableStream` for SSE search progress

## First-time setup (Windows / Laragon)

```bash
pnpm install
pnpm db:migrate         # creates data/vacation-finder.db
pnpm dev                # http://localhost:3000
```

`pnpm install` triggers the native rebuild for `better-sqlite3` because of the
`onlyBuiltDependencies` allowlist in `package.json`.

## Configuration

Copy `.env.example` to `.env.local` and fill in:

- `ANTHROPIC_API_KEY` — required for the chat panel on each search
- `TRAVELPAYOUTS_TOKEN` + `TRAVELPAYOUTS_MARKER` — register at
  <https://www.travelpayouts.com/> to get these. While they're empty, hotel data
  is faked but flight data is still real.
- `MOCK_SEARCH=1` — bypasses Ryanair and Hotellook and uses fully mocked data.
  Useful for UI work and demos without hitting external APIs. Remove or set to
  `0` to use the real APIs.
- `DATABASE_URL=./data/vacation-finder.db` — SQLite file location

## Useful scripts

```bash
pnpm dev              # dev server
pnpm build            # production build (typecheck + bundle)
pnpm lint             # eslint
pnpm db:generate      # generate a new Drizzle migration after editing schema
pnpm db:migrate       # apply migrations
pnpm db:studio        # browse the DB
```

## Project layout

```
src/
├── app/(main)/...            # UI pages (home, /searches, /searches/[id])
├── app/api/...               # POST /api/search, /api/searches, SSE stream, chat
├── components/               # search-form, results-list, trip-card, chat-panel
├── components/ui/            # shadcn-style primitives (Button, Card, Sheet, …)
├── lib/db/                   # Drizzle client, schema, queries
├── lib/ryanair/              # @2bad/ryanair wrapper with retry + caching
├── lib/hotels/               # Hotellook client + mock fallback + filters
├── lib/search/               # orchestrator, pairing, mock fixtures, runner, SSE
├── lib/ai/                   # chat loop, tool definitions, system prompt
├── lib/airports/             # static country + origin metadata
├── types/                    # SearchInput, TripOption, ProgressEvent, DTOs
└── ...
drizzle/                      # generated migration SQL (committed)
data/                         # SQLite file (gitignored)
```

## How a search runs

1. Client posts the form to `POST /api/search`. Server validates with Zod,
   inserts a `searches` row + a `running` `search_results` snapshot row, and
   kicks off `runSearch` in the background (`src/lib/search/runner.ts`).
2. Browser navigates to `/searches/[id]` and opens an `EventSource` against
   `/api/searches/[id]/stream?snapshot=<id>`. Progress events fan out from an
   in-memory bus keyed by snapshot id.
3. The orchestrator resolves Ryanair routes, fetches cheapest-per-day fares,
   builds (depart, return) pairs respecting min/max nights, picks 5 distinct
   cheapest destinations, then queries Hotellook (or the mock fallback) per
   destination and combines totals.
4. On completion, the snapshot row is filled with the JSON of trips. Refresh
   inserts another snapshot row — old ones are kept.

## Chat panel

Each saved search has a chat sheet on its detail page. The Anthropic SDK runs a
tool-use loop where Claude can call:

- `list_searches`
- `get_search_details`
- `refresh_search`
- `compare_trips`

Tool calls operate on the local SQLite DB only. The model is `claude-sonnet-4-5`,
capped at 1024 tokens per response.

## Out of scope (for v1)

- Authentication
- Vercel deployment (would need Turso swap and Playwright removal)
- Price drop alerts
- Open-jaw flights, time-of-day filters, PDF export
- Background cron / scheduled refreshes

## Canonical test input (per the project brief)

- Origin: OTP
- Destinations: Greece, Cyprus
- Window: 1 Jul 2026 – 31 Aug 2026
- Nights: 7–10
- 2 adults + 2 kids (ages 8 and 12), 1 room (2 adults + 2 children)
- Filters: pool ✓, beach &lt; 500m, min rating 7
- Currency: EUR

With `MOCK_SEARCH=1` this completes in &lt; 5 seconds and produces 5 distinct
destinations.
