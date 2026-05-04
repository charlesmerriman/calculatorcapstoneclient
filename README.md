# Uma Musume Carat Calculator — Frontend

A React SPA where players plan which Uma Musume Pretty Derby gacha banners to pull on and see a per-banner breakdown of carats and tickets they can expect to have saved by that banner's start date.

## Tech Stack

| Tool | Purpose |
|---|---|
| React 19 + TypeScript | UI and type safety |
| Vite 7 | Dev server and production bundler |
| Tailwind CSS 4 + DaisyUI | Utility-first styling with a component library |
| react-router-dom v7 | Client-side routing |
| react-hook-form | Form state and validation |
| react-select | Searchable dropdown components |
| date-fns | Date arithmetic for the resource projection engine |

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

### Auto-save

User changes trigger a 5-second debounced `PATCH` via the `useAutoSave` hook. A save-indicator in the UI reflects pending state, and an `onbeforeunload` guard warns if a save is in flight when the user tries to leave.

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

Public routes (`/login`, `/register`) live outside the `Authorized` guard. Auth token is stored in `localStorage`.

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
npx tsc --noEmit   # Type check
npm run lint       # ESLint
npm run build      # Production build → dist/
```
