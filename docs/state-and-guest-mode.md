# State, Auto-save, and Guest Mode

How the SPA holds its data, when it saves, and how anonymous users are supported.

For the resource math itself see
[resource-projection-logic.md](resource-projection-logic.md).

---

## State management

All data lives in a **single React Context** defined in
`services/CalculatorProvider.tsx`. The provider fetches everything on mount
(`initialCalculatorDataFetch`) and exposes it via `useCalculatorData()`.

The backend's `GET /calculator-data` returns one aggregated payload — all reference data,
the user's stats, planned banners, events, and banner timelines — specifically so the
frontend does not have to make N+1 fetches.

---

## Auto-save

For logged-in users, changes to user stats or planned banners trigger a **debounced PATCH
(5 s delay)** via the `useAutoSave` hook.

- Save state is surfaced through Sonner toasts.
- An `onbeforeunload` warning fires if a save is still pending.
- **Guests never arm the timer** — their plan is in-memory only.

---

## Guest mode

The app is fully usable without an account. No route requires one; signing in is only
needed to *save* a plan.

- The API returns `user_stats_data: null` for anonymous requests, and the frontend seeds
  `DEFAULT_GUEST_STATS` from that.
- Guests plan in memory. A refresh discards the plan, by design.
- A request carrying an **invalid** token still 401s even on public endpoints (DRF
  authenticates before permissions run). The frontend clears the token and retries as a
  guest.

### Guest → account migration (`services/guestMigration.ts`)

The Navbar shows a "Sign in to save" button that **snapshots the guest plan into
sessionStorage** (`guestPlanMigration.v1`, 1-hour expiry) before navigating to `/login`.

The snapshot is necessary because `CalculatorProvider` unmounts on route change — without
it the plan would simply be gone by the time the user came back.

On the next provider mount **with** a token, the stash is migrated via PATCH **before any
state is set**, so auto-save cannot race it:

- account banners are preserved (sent **with** ids),
- guest banners are appended (sent **without** ids),
- planned **purchases** follow exactly the same rule, in their own `purchases` key,
- guest stats are sent only if edited away from the defaults (`statsAreDirty`).

`purchases` is optional on `GuestPlanStash` so a stash written before the Selectors page
existed still validates — the version stays `1` because an absent key degrades to "no
purchases", which is correct rather than a reason to discard the whole plan.

The guest stash survives the OAuth round trip unchanged — sessionStorage persists across a
same-tab navigation to the provider and back — so social sign-in reuses this machinery
with no changes of its own.

---

## Social sign-in, client side

`services/socialAuth.ts`:

- `startSocialLogin(provider)` fetches the consent URL, parks
  `{provider, state, createdAt}` in sessionStorage under `oauthState.v1`, then
  `window.location.assign`s to the provider.
- `completeSocialLogin` reads and **immediately clears** that entry (single-use by
  design), compares the returned `state`, then POSTs the code.

`components/auth/OAuthCallback.tsx` drives this and **guards the exchange with a
`useRef`**. The authorization code is single-use, so StrictMode's double mount would
otherwise replay a spent code and show an error to a user who actually signed in fine.

Server-side flow, scopes, and the privacy constraints:
[../../backend/docs/auth-and-privacy.md](../../backend/docs/auth-and-privacy.md).

---

## Type system

Planned banners use a **discriminated union**:

- `SavedPlannedBanner` — has `id` (from the DB) and `user`
- `LocalPlannedBanner` — has `tempId` (client-only, before first save)

Narrow with the `isSavedBanner()` / `isLocalBanner()` type guards.

Request types use IDs (e.g. `banner_uma: number | null`); response types use nested
objects. All types live in `src/types/` and are barrel-exported from `src/types/index.ts`.

---

## Auth token

Stored in `localStorage` and attached to requests only when present.
