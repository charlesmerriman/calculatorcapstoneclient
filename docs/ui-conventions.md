# UI Conventions

Dates, styling, theming, the brand mark, and the Timeline list. These are the
frontend rules that are easy to break accidentally.

---

## Dates

**All user-facing dates go through `formatDate` in `utils/dateFormat.ts`**, which renders
`YYYY/M/D` (e.g. `2026/7/5`) — unpadded and locale-independent.

Do not hand-roll `toLocaleDateString` or date-fns `format` at a call site. Four such
copies previously drifted into two different locales and two different timezone bases.

### `parseApiDate` — the two shapes, and why the distinction is load-bearing

DRF sends two different date shapes, and they must be parsed differently:

| Shape | Example | Handling |
|---|---|---|
| Date-only | `"2026-07-16"` (e.g. `ChangelogEntry.date`) | Split by hand into a **local**-midnight `Date` |
| Full instant | `"2025-06-26T22:00:00Z"` (every banner/event date) | `new Date()`, formatted as a local calendar day |

The date-only case matters because `new Date("2026-07-16")` is **UTC** midnight, which
renders as the *previous day* anywhere west of Greenwich.

> Banner instants encode JST service-day boundaries (`22:00:00Z` start, `21:59:59Z` end),
> so the local calendar day can differ by one from the day the game shows in far-eastern
> timezones. This predates the helper and is unchanged by it — the helper preserves the
> interpretation the Timeline and banner rows already used.

---

## Styling and themes

Tailwind CSS 4. Custom react-select styles live in `utils/reactSelectStyles.ts` (dark
theme). The primary accent is `brand` (`#E6D28A`), defined as a custom Tailwind theme
color in `src/index.css`.

**Themes work by overriding the `@theme` CSS variables under `[data-theme="x"]` in
`src/index.css`.** The light theme *inverts* the gray ramp, so existing utilities keep
working unchanged. Read the comments there before adding a theme.

### Semantic status colors must be theme tokens, not palette classes

Tailwind's stock `green-400` / `red-500` are **not** theme-aware and measure ~1.35:1
contrast on the light theme. Any semantic status color that must survive a theme flip
belongs in `@theme` as its own token.

The `--color-pull-*` tokens (pull-count status, consumed by `.pull-input--*` in
`App.css`) are the worked example to copy.

### Gotcha: `@apply` in `App.css` cannot see custom `@theme` tokens

`App.css` opens with `@reference "tailwindcss"`, which loads only Tailwind's **stock**
theme. `@apply` there cannot resolve custom `@theme` tokens from `index.css`, and the
build fails with *"Cannot apply unknown utility class"*.

Reference such tokens as plain `var(--color-…)` instead.

(Stock names like `bg-gray-700` still work because the name exists upstream — the custom
value is substituted at runtime via the variable.)

### Animation

Framer Motion handles UI animations: the collapsible income section at the top of the
calculator page uses a `motion.div` height transition (no `AnimatePresence` — it never
unmounts while the page is up), the staging area uses `AnimatePresence` for enter/exit,
and `layout` props on banner list items animate reordering.

---

## Brand mark and display font

The site's brand mark is **text, not an image**. `components/Wordmark.tsx` renders
"Uma Carat Calculator" everywhere the old logo PNG appeared — navbar, sign-in card, OAuth
callback card, closed-beta passcode card. Change the brand text or its styling there and
all four update together.

It is set in **Outfit**, installed as `@fontsource-variable/outfit` and imported in
`main.tsx` so the woff2 is **bundled** rather than fetched from Google's CDN. That means
no third-party request on page load, and the app keeps working under a strict CSP — the
same constraint that already forces the inline Google/Discord SVGs in `Login.tsx`.

**Prefer `@fontsource` over a `<link>` to fonts.googleapis.com for any future font.**

The family is exposed as the `--font-display` `@theme` token (→ `font-display` utility)
and is used **only** by the wordmark; body text stays on the system stack.

### Why the nav wordmark stacks onto two lines until `lg`

The nav variant stacks onto two lines and only goes single-line at `lg`, not at `md`
where the desktop nav begins. This is deliberate: the nav carries its centre links plus
save/theme/settings/auth controls, and a single-line wordmark (~208px, vs the old logo's
~74px) overflows the `grid-cols-[1fr_auto_1fr]` row between 768px and ~900px. Stacked it
is ~85px, so it fits everywhere the image did.

Independently of the wordmark, that nav was **already** over-full at ≤900px — the
"Sign in to save" button wraps. That predates the wordmark. Moving the Income panel out
of the nav and into the calculator page bought back one centre link's worth of room, but
the wrap point has not been re-measured since.

---

## Timeline list (`components/timeline/Timeline.tsx`)

Renders `organizedTimelineData` — banner timelines, Champions Meetings and League of
Heroes events merged into one date-sorted list (~250 rows) — filtered by past/future and
a search box.

**Two list modes**, chosen by the user and remembered in
`localStorage["uma-planner-timeline-view"]`. Infinite scroll is the default; `"paged"` is
the opt-in value that restores the original 10-per-page view. Anything else (including a
blocked or absent store) falls back to infinite.

### Infinite scroll — the `visibleCount` dependency is intentional

The list reveals `INFINITE_CHUNK_SIZE` more cards each time a 1px sentinel `div` at the
end of the list comes within `INFINITE_ROOT_MARGIN` of the viewport.

**The effect that owns the `IntersectionObserver` lists `visibleCount` in its dependencies
on purpose.** An observer fires only on a *change* in intersection, so one left attached
across an append goes silent while the sentinel is still on screen — and the list stalls
one chunk in. That's the failure mode on tall viewports, where a chunk doesn't fill the
fold. Rebuilding the observer per append forces a fresh evaluation.

Guarded by `src/__tests__/Timeline.test.tsx`, whose fake observer fires each instance
**once**. A more permissive fake lets that regression through silently — see Testing below.

### Other Timeline rules

- **`SUPPORTS_INTERSECTION_OBSERVER`** is read once at module scope. Where there is no
  observer (jsdom, pre-2019 browsers) the list renders unwindowed, rather than stranding
  the reader partway down with no way to advance.
- **Both windows reset through `resetListWindow()` in the filter handlers, not from an
  effect.** Resetting in an effect commits the stale window and re-renders over it — a
  visible flash, and what `react-hooks/set-state-in-effect` flags.
- **Cards key off `timelineEventKey(event)`** (`cm-` / `loh-` / `bt-` + id). Ids are
  unique only *within* a model, and positional keys make React reuse a card's DOM —
  including decoded images — for a different event when the list grows or re-filters.
- Card images carry `loading="lazy"`; a banner card holds up to five, so a fully-revealed
  list is several hundred.

---

## Testing note

`Timeline.test.tsx` installs a fake `IntersectionObserver` via `vi.hoisted` — it has to
exist before the module is imported, since `Timeline` reads `typeof IntersectionObserver`
at module scope.

**Keep its fire-once-per-instance behaviour.** It models the real API (an observer reports
a *transition* into view, then stays silent) and is what makes the infinite-scroll stall
regression detectable.
