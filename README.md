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
- Dated `EventReward` entries filtered to the relevant date range
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

# Start the dev server (proxies API calls to the Django backend)
npm run dev
```

Other useful commands:

```bash
npx tsc --noEmit    # Type check
npm run lint        # ESLint
npm run build       # Production build → dist/
npm test            # Vitest in watch mode
npm run coverage    # Single-pass test run with V8 coverage report
```
