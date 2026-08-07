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

The same limitation applies to the custom **variants** below: `@apply desktop-nav:…` in
`App.css` fails for exactly the same reason. Put those utilities in the JSX.

### Responsive: `desktop-nav:` / `app-shell:` for the chrome, `md:` only for cosmetics

Two custom variants are declared at the top of `index.css`. They exist because a
width-only breakpoint cannot tell a small laptop from **a phone in landscape
(~844×390) or a tablet in portrait (~820×1180)** — both clear `md:` (768px) while
being unable to hold either desktop layout.

| Variant | Condition | Governs |
|---|---|---|
| `desktop-nav:` | `min-width: 64rem` | mobile ⇄ desktop navbar, and the `SettingsMenu` panel's anchoring, which must track the navbar |
| `app-shell:` | `min-width: 64rem` **and** `min-height: 32rem` | the fixed-height, internally-scrolling app shell in `ApplicationViews` |

The height half of `app-shell:` is the load-bearing part. Applied to a landscape phone,
the shell gives a ~330px scroll viewport *and* stops the document body from scrolling,
so the mobile browser's URL bar never auto-collapses — the cause of the "the calculator
won't scroll" reports. 32rem clears every phone in landscape (tallest ≈430px) while
staying below any real desktop or tablet window.

Plain `md:` is still fine for cosmetic tweaks (padding, font size, a 1-col → 2-col grid).
Use a named variant for anything that switches a whole layout.

The banner table is **not** on this list — see below.

### The banner table: one width token, and it must never scroll

`.banner-grid` in `App.css` owns every column width in the desktop banner table. Both
header rows (`CaratCalculator`) and both row bodies (`BannerRow`, `StagedBannerRow`)
apply it. **Never re-declare a width on a cell** — that is what this class replaced, and
four hand-copied sets of `w-*` utilities are how headers drift out of alignment with the
rows they label.

**The table is never horizontally scrollable.** The moment it doesn't fit, every row
falls back to `MobileBannerCard`. A row whose `# Pulls` input and delete button sit past
a scroll fold is the bug this design exists to prevent — those are the two controls the
page exists for.

That guarantee is enforced by a single token in `index.css`:

```css
--container-banner-table: 76.625rem;  /* 1002px of fixed tracks + the MLB column's 14rem floor */
```

Both sides of the switch read it, so they cannot disagree:

- `.banner-grid` sets `min-width: var(--container-banner-table)`
- Tailwind generates the `@banner-table:` **container-query** variant from it, because
  `--container-*` is the namespace container-query variants come from

A container query, not a media query, because the question is *"does the table's own box
fit the table"* — measured after the page's `max-width`, margins, borders and any
scrollbar have taken their cut. Deriving the equivalent viewport width by hand is easy to
get wrong (it lands near 1213px, not the ~1198px the arithmetic suggests, because a
classic scrollbar moves it). The wrapper carrying `@container` is in `CaratCalculator`,
one per section, around the header **and** its rows.

**Adding a column:** add the track to `.banner-grid`, add its width to
`--container-banner-table`, add one `<div>` to each header and one cell to each row body.
The switch point then moves on its own — the table simply starts yielding to cards a
little sooner.

**There is a hard ceiling on that token**, and overshooting it does not degrade
gracefully — it makes the table *disappear*. Set it above what the shell can hand the
table and the container query never matches at any viewport width, so every row silently
falls back to `MobileBannerCard`.

The ceiling was **1214px (75.875rem)** while the calculator sat in `.page-container`'s
`lg:max-w-7xl` (1280px, minus `mx-4` = 32, the panel border = 2, and `mx-4` again = 32);
a 76rem value did exactly this, missing by 2px. The calculator has since moved to its own
`max-w-[96rem]` canvas (`CaratCalculator.tsx`), which is why the current 76.625rem fits.
The **Timeline still uses `.page-container`**, so don't reuse this number for anything
outside the calculator.

Raising the token is still the wrong lever even below the ceiling: it is the minimum
width at which cards become the spreadsheet, so every increase makes the table yield to
cards on more screens. The Reserved column stayed at `5rem` for exactly this reason when
it gained a funding hint beneath its input — the hint was abbreviated (`2s 1c`, full text
in its `title`) instead of the track being widened.

So prefer **reclaiming measured slack from existing tracks** over raising the token. When
the derived-stats strip grew to four boxes, most of its space came from the images track
(144px holding two `h-14` thumbnails that need 126) and the select track. Measure before
you trim — the type badge needs 72px for "SUPPORT" and the date cell needs 108px with its
compact gutter for `Start: 2026/12/31`.

**Don't fund a track from the MLB column's `14rem` floor.** Six cells of `100.0%` want
~305px, so 14rem is already a deliberate squeeze, and it is also the only track that
absorbs surplus width above the switch point.

A track can also run out of room **vertically**. `BannerRow`'s Reserved cell is the one
exception to the row's `py-2`: its `h-9` input plus the 10px funding hint need 50.5px and
`py-2` leaves only 48px inside the `h-16` row, so it uses `py-1` for 56px. Don't normalise
it back to match its neighbours — the hint clips. `StagedBannerRow`'s copy renders no hint
and correctly keeps `py-2`.

**Column labels may be icons instead of text.** Reserved is the first one: it shows the
selector ticket (`/item_icon_00131.png`) and the SSR crystal (`/item_icon_00144.png`), the
two resources `allocateReservedCopies` can spend. Game-resource icons are served from
`public/` by root-absolute path with no import — the same convention `IncomeForm` uses for
its Current Resources rows — and each carries a meaningful `alt`.

An icon label must also keep a `sr-only` text label: a `title` on a `div` is not reliably
announced, so without the span the column has no accessible name at all.

Both come from `components/carat-calculator/ReservedColumnIcons.tsx`, which returns a
fragment so each call site owns its wrapper, and exports `RESERVED_COLUMN_TITLE` so the
tooltip wording stays one string. **A column label appears in three places** — the staging
header, the sheet header (both in `CaratCalculator`) and the mobile card's cell label in
`MobileBannerCard`. Changing only the headers leaves the phone showing the old text. Sizes
differ deliberately: `w-5` in the headers against `text-xs`, `w-4` on the card where the
neighbouring "Dates"/"Pulls" labels are 10px caps.

### Portaled `react-select` menus need `menuPosition="fixed"`

Every select using `menuPortalTarget={document.body}` also sets `menuPosition="fixed"`.
The portal attaches to `<body>`, but the control can live inside the app shell's vertical
scroller; with the default absolute positioning the menu is placed against the body and
visibly detaches from its control as soon as that container scrolls.

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

**Two card shapes, three event types.** Champions Meetings and League of Heroes events
share one course-details card, `components/timeline/RaceEventCard.tsx`; banner
windows keep the wider three-column card inline in `Timeline.tsx`. `RaceEventCard` never
branches on which of the two it has — if it ever needs to, they've stopped being the same
card and should be split again. `RaceEventCard.test.tsx` renders one of each from the same
data and diffs the markup, so a change applied to only one type fails there.

**Narrow with `isRaceEvent()` / `isBannerTimeline()`** (from `types/calculator.ts`), never
by sniffing properties. The three shapes are not reliably distinguishable structurally: the
two race types are field-identical apart from their number, and a banner window shares
every base field with both. The guards read the backend's `event_type` tag instead. The old
`"track" in event` checks needed `as unknown as` casts to compile — a signal the narrowing
was fictional — and would have silently mis-sorted every League of Heroes event as a
Champions Meeting once the two shapes converged.

**Two list modes**, chosen by the user and remembered in
`localStorage["uma-planner-timeline-view"]`. Infinite scroll is the default; `"paged"` is
the opt-in value that restores the original 10-per-page view. Anything else (including a
blocked or absent store) falls back to infinite.

**The paged view's current page is remembered too**, in
`sessionStorage["uma-planner-timeline-page"]` — the route unmounts on every trip to the
calculator, so without it the reader was thrown back to page 1 each time. Session, not
local, storage: a page index is a position within one visit, and the list is date-filtered,
so restoring page 12 days later would point at unrelated events. `goToPage` is the only
writer, so the filter resets clear it as well. A restored page that now exceeds
`totalPages` is clamped in render (`effectivePage`) rather than corrected from an effect —
the fetch hasn't resolved on the first render, and resetting state there would both flash
the wrong list and permanently discard the saved position. Search text and the past/future
toggle deliberately do *not* persist.

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

## Selectors page (`components/selectors/`)

`/app/selectors` is the third nav destination, alongside Calculator and Timeline. It
holds everything about anniversary campaigns: discounted carat packs, selector tickets,
USD budgeting, and the two toggles that govern whether any of it reaches the projection.

- **`Selectors.tsx`** — page root. Zero props, reads `useCalculatorData()`, owns the
  purchase upsert handlers. Follows `UncapCrystalsPanel`'s conventions.
- **`CampaignCard.tsx`** — one campaign: packs with quantity steppers, selectors with a
  target picker, and the per-campaign / cumulative footer.
- **`SelectorTargetPicker.tsx`** — the card picker, filtered by the selector's JP cutoff.
  Candidates come from the calculator's past and upcoming gacha-banner catalogue, not a
  new endpoint. Spreadsheet catch-all rows such as `(All)` are excluded from the selector
  list.
- **`timeline/AnniversaryEventStrip.tsx`** — the band that sits flush on top of a banner
  card when that banner is part of a campaign. It keeps only its **top** corners rounded
  and the caller squares the card's top corners (`rounded-b-xl rounded-t-none`) so the
  two read as one unit. Nothing inside the card moves; an unattached banner is unchanged.

Campaign chrome is keyed off the backend's `event_type` tag (`anniversary` / `new_year` /
`campaign`) in both the card and the strip — never off the name.

**Money goes through `formatUsd`** (`utils/formatCurrency.ts`), never a hand-rolled
`toLocaleString` at a call site — the same rule as `formatDate`. It is pinned to en-US /
USD deliberately: the sheet's prices are US store prices, and rendering them as €70 would
present a converted figure nobody computed.

## Testing note

`Timeline.test.tsx` installs a fake `IntersectionObserver` via `vi.hoisted` — it has to
exist before the module is imported, since `Timeline` reads `typeof IntersectionObserver`
at module scope.

**Keep its fire-once-per-instance behaviour.** It models the real API (an observer reports
a *transition* into view, then stays silent) and is what makes the infinite-scroll stall
regression detectable.
