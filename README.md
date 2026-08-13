# Uma Musume Carat Calculator — Frontend

A React SPA where players plan which Uma Musume Pretty Derby gacha banners to pull on and see a per-banner breakdown of carats and tickets they can expect to have saved by that banner's start date.

## Tech Stack

| Tool | Purpose |
|---|---|
| React 19 + TypeScript | UI and type safety |
| Vite 7 | Dev server and production bundler |
| Tailwind CSS 4 | Utility-first styling |
| Framer Motion | Animations and transitions |
| Sonner | Toast notifications (save feedback, auth errors) |
| react-router-dom v7 | Client-side routing |
| react-hook-form | Form state and validation |
| react-select | Searchable dropdown components |
| date-fns | Date arithmetic for the resource projection engine |

### Dev tooling

| Tool | Purpose |
|---|---|
| Vitest | Unit test runner (shares Vite config, runs instantly) |
| React Testing Library | Hook and component testing utilities |
| @vitest/coverage-v8 | V8-based coverage reports |

## Architecture

### State management

All server state lives in a single `CalculatorProvider` context (`services/CalculatorProvider.tsx`), fetched once on mount via a single aggregated API call. Components consume it through the `useCalculatorData()` hook and stay free of fetch logic.

### Resource projection (`useBannerResources`)

The core business logic hook. For each planned banner it walks forward in time from today to the banner's end date, accumulating:

- Daily base income (75 carats/day + weekday bonuses)
- Weekly rank payouts (Team Trials, every Monday)
- Monthly rank payouts (Club rank)
- Champions Meeting event payouts
- `GameEvent` reward fields filtered to the relevant date range, plus a prorated share of each event's `carats_throughout`
- Free pulls granted by the banner itself

The result is a per-banner forecast of carats and tickets available at the banner's end date.

### Guest mode

The whole app works without an account. Anonymous visitors get the full reference payload from the API (with `user_stats_data: null`), are seeded with local default stats (`DEFAULT_GUEST_STATS` in `services/guestMigration.ts`), and plan entirely in memory — a refresh discards the plan. When a guest clicks **Sign in to save**, their plan is snapshotted into sessionStorage (key `guestPlanMigration.v1`), and after login/register the provider migrates it to the account: existing account banners are preserved, guest banners are appended, and guest stats are only sent if they were actually edited from the defaults.

### Auto-save

For logged-in users, changes trigger a 5-second debounced `PATCH` via the `useAutoSave` hook. A save-indicator in the UI reflects pending state, and an `onbeforeunload` guard warns if a save is in flight when the user tries to leave. Guests never arm the timer — their plan is in-memory only.

### Type system

Planned banners use a **discriminated union**:
- `SavedPlannedBanner` — has `id` (synced to the database)
- `LocalPlannedBanner` — has `tempId` (client-only, before first save)

`isSavedBanner()` / `isLocalBanner()` type guards enforce the distinction at compile time. All types are barrel-exported from `src/types/index.ts`.

## Views

| Route | Component | Description |
|---|---|---|
| `/` | `CaratCalculator` | Main planner — current resources, pull plan, per-banner forecasts |
| `/timeline` | `Timeline` | Banner and Champions Meeting calendar |

All routes are public — the calculator works for guests, and an account is only needed to save a plan (see Guest mode above). The auth token is stored in `localStorage` and attached to requests only when present.

## Local Setup

```bash
cd frontend

# Install dependencies
npm install

# Create a .env file
echo "VITE_API_URL=http://localhost:8000" > .env

# Start the dev server (calls the local Django backend)
npm run dev
```

## Choosing a backend

Two dev commands, differing only in which API they read:

```bash
npm run dev         # local Django on :8000  — full read/write, sign-in works
npm run dev:live    # live production API    — real content, read-only
```

`dev:live` is `vite --mode live`, which loads [.env.live](.env.live) and
overrides `VITE_API_URL` for that run only. Flipping is just stopping one and
starting the other — nothing to edit, nothing to remember to put back. A
**LIVE DATA** badge appears bottom-left so the two are never confused.

Use `dev:live` for frontend work that needs realistic content: the local
database has no seeding path any more (see
[../backend/README.md](../backend/README.md#there-is-no-seeding-step--a-fresh-local-database-starts-empty)),
and production content is edited through the admin panel, so the live API is the
only accurate source for it.

**It cannot write to production.** Saving requires an auth token, and you cannot
obtain one here — the backend derives its OAuth redirect from its own
`FRONTEND_URL`, so a sign-in round-trip lands on the deployed site instead of
localhost. Everything the calculator does in guest mode works; anything that
would persist is simply unavailable. Use `npm run dev` when you need to test
sign-in or saving.

### Why `dev:live` pins the port

The live backend accepts these requests because Django's `CORS_ALLOWED_ORIGINS`
defaults to `http://localhost:5173` and production does not override it. That
origin is matched **exactly**, port included — so if Vite were allowed to fall
back to `5174` because `5173` was busy, every request would die in preflight
with a CORS error that looks like the API being down.

Hence `--port 5173 --strictPort`: it fails immediately with "Port 5173 is already
in use" instead of starting on a port the server will reject. If you hit that,
stop the other dev server rather than changing the port here.

Two related notes: if a `CORS_ORIGIN_WHITELIST` is ever set on the DigitalOcean
component, add the localhost origin back or `dev:live` stops working. And plain
`npm run dev` has no such constraint — a local backend you control can be told
about any origin.

Other useful commands:

```bash
npx tsc --noEmit    # Type check
npm run lint        # ESLint
npm run build       # Production build → dist/
npm test            # Vitest in watch mode
npm run coverage    # Single-pass test run with V8 coverage report
```
