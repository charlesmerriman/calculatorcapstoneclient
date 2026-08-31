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
`App.css`) are the worked example to copy. `--color-category-revival[-border]`
(`.category-chip--revival`, the Golden Week marker on a timeline section) follows the same
pattern: dark values in `@theme`, deepened counterparts under `[data-theme="light"]`.

A brand-derived tint would have been the obvious shortcut and is wrong here — the chip has
to read as "not the usual banner" against seven different brand hues, and would vanish into
the card's existing brand-colored labels on every one of them. Only the headline category
gets a hue; reruns and race-prep batches use the gray ramp so the one signal stays
meaningful.

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

### Three banner-row kinds, and where each is drawn

The planner has three kinds of row — Uma, Support and **Step Up** — and a row's kind is
carried on the `BannerRowType` tag, never inferred from which FK is set (see
`plannedBannerRowType`). Each kind's presentation lives in exactly one place:

| What | Where |
|---|---|
| Type badge + glyph (desktop) | `BannerTypeBadge` |
| Type glyph alone (mobile card) | `BannerTypeIcon`, same module |
| Badge background colour | `.banner-type-tab--uma / --support / --step-up` in `App.css` |
| Mobile tile colour + thumb radius | `TYPE_STYLES` in `MobileBannerCard` |
| Which catalogue the row's select offers | `bannersForRowType` in `bannerHelpers` |

These are stock palette classes (`bg-blue-900` / `bg-green-900` / `bg-purple-900`), not
`@theme` tokens — the token rule applies to theme-sensitive **status** colours, which
these are not.

Adding a fourth kind means touching each row of that table once. It used to mean finding
six hand-copied ternaries, any of which failed silently by rendering another kind's
treatment.

#### The derived-stats strip relabels per row

Two of the four stat boxes say something different on a step-up row:

| Box | Uma / Support | Step Up |
|---|---|---|
| 1 | Free/Tickets/Paid | **Step #** (`5x2-3`) |
| 4 | Max Pulls | **Max Steps** |

The source spreadsheet does this by swapping its column *headers*. Ours are global to the
table, so the swap lives in the per-row strip instead — where the meaning actually
changes. **Same four boxes at the same widths**: `--container-banner-table` does not move
for it, and must not.

The `# Pulls` input likewise keeps its column and changes what it counts, down to its
`aria-label` ("Number of steps") and its green threshold — every 5 rather than every 200,
because a step-up's unit of completion is a five-step round, not a pity counter.

A step-up has no featured cards to thumbnail, so its images cell falls back to a
typographic `★3` / `SSR` chip carrying the campaign's JP cutoff. Phone cards spell the
cutoff out in the dates block, which has vertical room the `h-16` desktop track does not.

#### The Income & Resources panel on a phone

This panel is the first thing on the calculator page and it is a form, not a summary, so
on a phone it starts **collapsed** — the banner sheet below it is what most visits are
for. Two consequences follow, and both are load-bearing:

- **The header is the only thing a phone user sees**, so it has to look openable. A title
  with a chevron beside it reads as a title; the boxed chevron plus a `Show` / `Hide` word
  reads as a control. The word is phone-only — a desktop load has the panel already open,
  where a chevron beside a visible body is unambiguous.
- **The panel is square-cornered below `sm:`.** The calculator's container carries the
  radius, and with only an 8px gutter either side on a phone the panel is all but
  full-bleed; a 12px radius across a band that wide reads as a stray curve rather than a
  card, most visibly on this header because it is the top edge.

Open, it used to run ~1690px on a 390px viewport — over four screens for four selects,
two toggles, eight fields and five figures. It is now ~1070px, and the savings came from
the same idea applied four times: **a phone gets a denser arrangement of the same content,
never less of it.**

| Block | Phone | From `sm:` |
|---|---|---|
| Competitive Progress | 2 lines per rank — icon, label, income badge; select below | one 4-column grid row |
| Purchases / Bonuses | badge shares the toggle's line | unchanged |
| Current Resources | 2 columns, 24px icons, 11px labels, `w-14` fields | 1–2 columns, full size |
| Average Monthly Income | a row list, label left / figure right | tiles, label over figure |

The rank rows are the subtle one. All four ranks live in **one** grid so their columns line
up on desktop, which means `order` (container-wide) cannot move a single rank's badge onto
its label's line. Each rank therefore owns a wrapper that is a `flex` row on a phone and
`sm:contents` above it — `display: contents` dissolves the wrapper so its children join the
parent grid exactly as they did before. Reach for that pairing whenever a phone needs
per-item grouping that desktop needs flattened.

#### The banner select must read as a control, not a title

On the card, the banner select sits in the coloured header where the row's name belongs,
and it used to be styled to disappear into it — transparent fill, transparent border, a
lone chevron. A chosen banner then read as the card's title, which was the intent; an
**unchosen** one read as a title too, which was not. The empty state is exactly where the
control has to look clickable, and it was the least obvious of the two.

Two things fix it together, and neither works alone:

- **The control is a field.** Translucent black fill, a white-alpha border, and a real
  focus state. Alphas rather than theme tokens because this control has three different
  backgrounds to read against — the row's type colour, blue / green / purple from
  `TYPE_STYLES` — and no single token suits all three. The old style also set
  `boxShadow: "none"` unconditionally, which took the keyboard focus ring with it.
- **The placeholder is an action.** `Target Support Banner` is a noun phrase and reads as a
  heading; `Select a support banner…` reads as an empty field. Same string on the desktop
  select, which shares the call site.

The field's border and padding come out of the banner name, which is the first thing in
this header to ellipsis. That is why the gutters around it are as tight as they are
(`px-1`/`gap-0.5` on the thumbnail rail, `mr-1` on the delete button, 3px on the chevron):
they were retuned to hand the name back the ~14px the border cost it. Widen any of them
and the name starts truncating a word earlier.

#### The phone card is four bands, and each one owns its own padding

`MobileBannerCard` stacks four full-bleed bands: the coloured identity header, a
dates/pulls/reserved row, the derived-stats strip, and the odds. Nothing is inset inside
anything else, and the `summary` / `chanceDisplay` slots are handed to the caller
**edge to edge** — the card adds no gutter of its own. `BannerRow` fills them with a strip
that wants to read as another band; `StagedBannerRow` fills them with a confirm button
that wants a gutter and adds its own `p-3`. A shared `p-3` in the card charged 24px of
height to every row to satisfy only one of them.

**A staged card is three bands, not four**: `chanceDisplay` is optional and
`StagedBannerRow` passes none, so the phone loses the odds strip on a row that isn't on
the sheet yet. The desktop table keeps its MLB column on staged rows — the width there is
already paid for by the grid. Because the confirm button is then the card's last band, it
carries a full `p-3` rather than the `p-3 pb-0` it used while the odds strip supplied the
bottom gutter.

Four rules keep the phone card short, and each replaced something that measurably didn't
fit at 390px:

- **The dates always stack**, at every card width. `Start:` / `End:` side by side want
  ~234px and the date column can only spare ~150 of a 390px viewport, so "End: …" used to
  slide underneath the pulls field and read as clipped. A range that runs down at one
  width and across at the next is also harder to scan than one that always runs down, and
  the desktop table stacks them too — it renders its own pair, not `dateDisplay`. There is
  no "Dates" caps label for the same width reason; `Start:` and `End:` label the column
  well enough alone.
- **The pull ceiling sits beside the pulls field, not in the strip.** "Max Pulls" (or
  "Max Steps") is the bound the field is judged against, and reading it three bands down
  meant looking away from the number you were editing. It is `MobileBannerCard`'s
  `maxCount` slot, built from `derivedStats[3]` so the step-up relabel keeps happening in
  one place, and it is **phone only** — above `sm:` the cell hides and the stat returns to
  the strip, which has room for four boxes. The band's `sm:` template therefore has three
  tracks against the phone's four; a `display:none` cell isn't placed, so the remaining
  three line up on their own. A **staged** row passes no `maxCount` at all: it has no
  projection yet (`useBannerResources` hasn't run for it), so there is no ceiling to name.
- **The stats strip is three across in one row.** With the fourth box moved up beside the
  pulls field, the remaining three fit a single row instead of two. Their labels wrap
  rather than truncate — a ~320px card gives each box about 93px, which is exactly what
  "Free/Tickets/Paid" wants — so never put `truncate` on a stat label or value.
- **The odds strip is six across at every width** — on a sheet row, which is the only kind
  of card that shows it. Wrapping to 3x2 below `sm:` doubled its height for cells needing
  ~30px each; a 320px card still gives every one ~53px, which is more than the desktop
  table's own 14rem track manages.

Together those took a phone row from ~370px to ~225px — roughly four rows per screen
instead of two. The `sm:` layout (a card between 640px and the table switch) keeps its
inset three-across panel and its four-box strip; only the stacked dates reach it.

The one width the phone card cannot simply absorb is ~320px, where the date line wants 3px
more than its column has. That is handled with a container-query variant on the date text
(`@max-[18rem]:text-[11px]`), not a media query: the question is how wide *this card* is,
and the card is already inside the `@container` that decides card-vs-table.

**The images cell is a link to the row's banner window on the Timeline** — on every row
kind including step-ups and staged rows, and inert only on a row with no banner picked
yet. See "Deep links from the sheet to the Timeline". The `<Link>` carries the cell's own
flex box so it adds no width (`--container-banner-table` does not move for it), and it is
*inside* the `relative` cell, which is what keeps `ExtraCardsBadge`'s absolute positioning
resolving against the cell as before. On phone cards the href is passed to
`MobileBannerCard` rather than the caller wrapping `imagesSlot`, because the ordinary rows
render their thumbnails inside that component and never go through the slot.

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
neighbouring "Pulls" label is 10px caps.

### Section bands: scenarios and anniversaries between planner rows

`PlannerSectionBand` draws a full-width centred band between rows of the sheet, marking the
scenarios and anniversaries occurring between the first and last planned banner.
`utils/plannerSections.ts` builds the render list.

- **Scenario bands only — `SCENARIO_BANDS_ONLY`, a constant, not a setting.** There is no
  UI to turn anniversary bands on. A scenario launch changes how the game is played, which
  is the landmark a planner navigates by; anniversaries recur on a schedule the user
  already knows, and banding them doubles the number of interruptions in the sheet.
- **`buildPlannerRows` filters by kind BEFORE placement**, via its optional fourth argument
  (`PlannerBandVisibility`, a `Record` keyed on marker kind so a new kind can't be added
  without a decision). Filtering after placement would leave a scenario rendering as the
  second line of a band whose anniversary first line had been hidden. Told nothing, the
  builder builds everything; the call site states which kinds ship. That parameter and its
  tests are what make a future settings surface a matter of passing a different record
  rather than reworking placement.

- **The band is not `.banner-grid` and adds no track.** It spans the row stack as a plain
  `w-full` block, which is what keeps `--container-banner-table` (and its hard ceiling)
  out of it. That also means one component serves both display modes — the stack renders
  mobile cards below the container width and table rows above it.
- **`buildPlannerRows` carries each row's ORIGINAL index.** `bannerResources` is positional
  against `userPlannedBannerData`, so reading it by position in the *banded* list
  mis-attributes every row's resources the moment a band appears. There is a test on this.
- **Placement**: a scenario pins immediately above its own launch banner (its start date IS
  that banner's), whatever else shares that instant; everything else places before the
  first row starting on or after it. Markers landing at one point collapse into a single
  band, **scenarios above anniversaries** — they routinely launch together, and the
  scenario is the larger statement.
- **An anniversary bands at its `main_start_date`, not its `start_date`.** The campaign
  opens with a Part 1 of login rewards announcing the anniversary; the anniversary itself
  is Part 2, roughly ten days later, and the band marks the event rather than the run-up.
  The Timeline's campaign card (`EventMarkerCard`) places on the same date for the same
  reason, so the two surfaces agree — it just also states the campaign's full window,
  reading "<the anniversary opens> through <the campaign closes>". Read it as
  `main_start_date ?? start_date`; the two are the same instant for New Year campaigns and
  one-off promotions.
- **Each line links to the same landmark's card on the Timeline** (see "Deep links from the
  sheet to the Timeline" below). The whole strip is the anchor, not the label — the row is
  otherwise empty, so a text-width target in a full-width band is needlessly hard to hit —
  and the affordance is a hover underline plus a faint wash, with **no arrow glyph**: the
  one thing distinguishing a scenario line from an anniversary one is having no icon.
- Bands are sheet-only; the staging area is a scratch space and gets none. A sheet of fewer
  than two rows gets none either — there is no "between".
- Colour is the `--color-brand` token (`text-brand` / `bg-brand/10`), never a literal gold,
  so it survives the light-theme flip. The two kinds differ by **weight, hue and the
  anniversary's sparkle** — a scenario line carries no icon at all — see the note above on
  only the headline signal getting a colour.
- **Strip fills alternate per DATE, not per line.** A band collapses markers by insertion
  point, so it can hold two moments *or* two lines that are the same moment (a scenario
  launching the day an anniversary lands — the common case, since scenarios usually debut
  alongside one, and reachable again the moment anniversary bands are turned back on). One
  fill therefore means "one date" and a change of fill means "a different one". Grouped on
  the **UTC** calendar day, like everything else in the
  projection, so the striping can't vary by the viewer's timezone.

This is deliberately not `AnniversaryEventStrip`, whose `rounded-t-xl border-b-0` geometry
exists to weld onto the top of a timeline card and which is left-aligned.

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
windows use the wider card in `components/timeline/BannerWindowCard.tsx`. `RaceEventCard`
never branches on which of the two it has — if it ever needs to, they've stopped being the
same card and should be split again. `RaceEventCard.test.tsx` renders one of each from the
same data and diffs the markup, so a change applied to only one type fails there.

### Concurrent banners are one card, grouped at render time

`groupTimelineEvents` (`timelineShared.ts`) folds banner events sharing an **exact**
`start_date` into one `BannerWindowGroup`, rendered as a single card: shared header with the
union window, then one section per constituent banner, each keeping its own panels and its
own "Add to Planner". A section whose own end date differs from the header's says so.

- **Grouping runs last**, after the past/future and search filters. Grouping first would let
  a window straddle the boundary and pull an ended banner into the current view.
- **Exact string equality, not the calendar day.** Both agree on every row in production
  (eight groups, sixteen rows); exact equality can't merge two banners a reader west of GMT
  sees on different dates.
- **The rows must not be merged in the database.** They are separate gacha pools with
  separate pity, `UserPlannedBanner` foreign-keys `BannerUma` rather than the timeline, and
  their end dates can differ — and income is a pure function of a banner's end date.
- A group of one is the common case and is the *same* code path, so there is no second
  layout to keep in sync.

### Count drives the layout, category drives the accents

The **card count** decides whether a panel abandons its column for a full-width band
(`COLUMN_TILE_CAPACITY`, currently 2 — a feature column is ~260px, two tiles across).
`banner_category` picks the chip and the column weighting (`CATEGORY_CHROME` in
`BannerWindowCard.tsx`), and can still *force* a band.

That way round because of the JP launch banner: a `standard` row with 9 umas and 20 support
cards and no art. No category flagged it, and none should have to — the counts are right
there. A miscategorised revival therefore still renders every card.

**Banding is PER PANEL, not per section.** Only the cards that don't fit take the extra
width; the other panel keeps its place beside the art. This was briefly section-wide, which
reads plausibly and is wrong on the commonest shape we hold: 22 of the 29 race-prep rows are
one uma and ten support cards *with* art, and banding the section threw the art onto its own
line and left a single uma tile adrift in a full-width panel. Five combinations occur in
production — race-prep with art (22), race-prep without art (4), race-prep with no uma (3),
revival (4), launch banner (1) — and any change here should be checked against all five.

- The art cell needs **real art** to appear once anything has banded. A "Banner art coming
  soon" placeholder is a third of an ordinary three-column row and reads as pending, but
  beside a lone uma tile with the real content banded below it is ~1030px of empty box. Where
  dropping it leaves a single panel, the panel keeps its column width (`max-w-md`) rather
  than stretching across a row it is the only occupant of.
- Two column panels implies nothing banded — a banded panel is by definition not in a column
  — so `SECTION_COLUMNS` is only ever reached by the ordinary case and can be reasoned about
  as such.
- **Banner art is capped on its WIDTH (`BANNER_ART`, 41rem), never its height, and it sits
  hard left.** The assets are 16:9, so an uncapped `w-full` makes the height a function of
  whichever column template the section landed in: ~358px on an ordinary three-column row,
  but ~580px under the old weighted `SECTION_COLUMNS_PAIR`, and taller still below `xl`
  where the grid collapses to one column. 41rem sits just above the three-column ceiling, so
  ordinary rows are untouched and only the wider shapes clamp, landing at ~369px.
  Do **not** reach for `max-h` instead: with a percentage width the used width is already
  definite, so a height clamp just squashes the picture (measured 1030×580 → 1030×368,
  aspect 1.78 → 2.80). Capping width leaves `height: auto` free to track the intrinsic
  ratio. The cap only ever eats space to the art's *right*, so its left edge stays on the
  section's left edge in every template — the ordinary three-column row has no slack to
  distribute, and centring the capped shapes was what put them out of line with it.
  `BANNER_ART_ALONE` is the sole exception: the art-only branch (every panel banded, e.g.
  race-prep with no uma) has a full-width row and no column edge to align to, so it centres.
- **`SECTION_COLUMNS_PAIR` is two EQUAL halves, and both occupants are pinned to an outer
  edge** — art hard left, panel hard right (`PAIR_PANEL_CELL`) and capped at 28rem, the width
  it has in a three-column row, rather than filling its half. It was a weighted 1.6fr/0.7fr
  split, which only worked while the art expanded to fill whatever column it was handed; once
  the art was width-capped the two stopped agreeing, leaving the art adrift mid-column beside
  a panel flush right. Pinning both is what makes that right edge read as deliberate instead
  of accidental — the slack collects in one span between them rather than in three uneven
  ones. Both caps are `xl`-only: below that every template collapses to one stacked column
  and both should fill it.
  - The trade is that the slack is *large* — ~390px at a 1573px viewport, sitting above four
    support tiles in the band below. Equal halves make the split easy to reason about, but if
    that void ever needs closing, size the first track to the art (`xl:grid-cols-[41rem_1fr]`)
    rather than re-centring either occupant.
- **A band is exactly one line at every width, and nothing about it is breakpoint-driven.**
- The line is a flex row, and the card count sets a **minimum** tile width rather than an
  exact one: each tile grows to an equal share of the row, refuses to shrink past
  `bandMinWidthClass` (7rem uma / 6rem support), and the row overflows into the band's own
  `overflow-x-auto` scroller when the minimums don't fit. Only the launch banner's twenty
  supports actually scroll on a desktop screen.
- **Growth sits on a wrapper around each tile, not on the tile.** That is what reproduces
  the old grid's `justify-items-center` spread — the wrapper takes its share of the line, the
  tile stays centred inside it at its own capped width. Put the growth on the tile and a
  four-uma revival stretches into four wide slabs.
- The row carries no `justify-*`. The wrappers always fill the line exactly, so there is
  never free space to distribute — and `justify-center` on a row that *does* overflow strands
  its first tile off the left edge where scrolling cannot reach it.
- This replaced a table of `xl:grid-cols-N` classes that produced the line only above
  1280px; below that the band fell back to two columns, so a ten-card race-prep batch
  rendered as a 2×5 tower. **Don't reintroduce a breakpoint here.** Tests assert the line by
  counting a flex row's children, which is what makes "one line" checkable in jsdom at all.
- **Band names shrink one measured tier** — ~160px column (two lines), band (three lines,
  13px). The old ~72px "dense" tier went with the squeeze that forced it; no band tile now
  renders below its minimum width.
- `race_prep_support` inverts the section's column weights (narrow uma, wide support grid) and
  must degrade to zero umas; two of the sheet's 32 rows have none.
- `standard` gets no chip at all. A badge on every card is noise, not signal.
- **`CATEGORY_LABELS` in `timelineShared.ts` is the only place the category names are
  written.** They appear both on the chip and in the filter's dropdown, and a reader
  filtering for "Golden Week Revival" has to see that exact phrase on the cards that
  come back.
- **The category filter runs on groups, not events**, and a window survives if *any* of
  its banners matches — filtering for revivals must keep the ordinary banner sharing that
  card, or the week looks emptier than it was. Race events drop out whenever a category is
  selected, since a Champions Meeting has no banner category to match. The dropdown only
  offers categories actually present in the data, so `race_prep_support` stays hidden until
  the support backfill lands rather than being an option that can only return
  "No events found."
- **Never reintroduce `grid-rows-1`, `xl:overflow-hidden` or `xl:[contain:size]` on a feature
  panel.** That trio pinned the panel to the banner art's height and silently discarded every
  tile past the first row — two of eleven umas shown, nine gone, nothing on screen saying so.
  jsdom applies no CSS, so only the class-name assertions in `Timeline.test.tsx` catch it.

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

### Infinite scroll — the reveal-count dependency is intentional

The list reveals `INFINITE_CHUNK_SIZE` more cards each time a 1px sentinel `div` at the
end of the list comes within `INFINITE_ROOT_MARGIN` of the viewport.

**The effect that owns the `IntersectionObserver` lists `revealCount` in its dependencies
on purpose.** An observer fires only on a *change* in intersection, so one left attached
across an append goes silent while the sentinel is still on screen — and the list stalls
one chunk in. That's the failure mode on tall viewports, where a chunk doesn't fill the
fold. Rebuilding the observer per append forces a fresh evaluation.

`revealCount`, not the raw `visibleCount` state, because a deep link can widen the
revealed prefix without touching that state — see "Deep links from the sheet to the
Timeline". `revealMore` measures from the same value, which is what keeps every append
visible and so keeps this dependency changing on every one of them.

Guarded by `src/__tests__/Timeline.test.tsx`, whose fake observer fires each instance
**once**. A more permissive fake lets that regression through silently — see Testing below.

### Step-ups are announced on the campaign strip

`AnniversaryEventStrip` renders a chip such as "2 ★3 + 3 SSR Step-Up" from the
`banner_step_ups` summary on each timeline row, summed per pool by `formatStepUpChip`.

It is there for discoverability, not decoration: nothing else on the site indicates
step-up banners exist until you press the calculator's third Add button. Because a
step-up's FK points at the campaign **Part** it runs in, the chip lands on exactly one
card per campaign with no filtering.

### Other Timeline rules

- **`SUPPORTS_INTERSECTION_OBSERVER`** is read once at module scope. Where there is no
  observer (jsdom, pre-2019 browsers) the list renders unwindowed, rather than stranding
  the reader partway down with no way to advance.
- **Both windows reset through `resetListWindow()` in the filter handlers, not from an
  effect.** Resetting in an effect commits the stale window and re-renders over it — a
  visible flash, and what `react-hooks/set-state-in-effect` flags.
- **Cards key off `timelineRowKey(row)`** — `cm-` / `loh-` + id for race events, `win-` +
  the shared start date for a banner window. Ids are unique only *within* a model, and
  positional keys make React reuse a card's DOM — including decoded images — for a
  different event when the list grows or re-filters. A window keys on its date rather than
  its first banner's id so the key survives the API reordering banners inside a group.
- Card images carry `loading="lazy"`; a banner card holds up to five, so a fully-revealed
  list is several hundred.
- **Every timeline image DECLARES its aspect ratio, and this is not decoration.** Banner,
  marker and race art are `aspect-[16/9]`, uma tiles `aspect-square`, support tiles
  `aspect-[3/4]` — measured across the live CDN (1024×576 / 680×383, 360×360, 450×600,
  no exceptions). A lazy image with only `h-auto` is 0px tall until it decodes and then
  snaps to full height: eight banner images measured in Chrome moved the content below
  them by **2952px**, so a seventy-card reveal shifts by some 26,000px while you read.
  That is what made the deep-link scroll below unable to arrive. `object-contain` rides
  along with each ratio so an asset that is ever *not* that shape letterboxes instead of
  stretching — the same distortion the width-cap rule above is about, from the other side.
- **`BannerArtPlaceholder` holds the same 16:9 box**, not a min-height of its own. A
  stand-in of a different height still moves the page when the real art arrives.

### Deep links from the sheet to the Timeline

`/app/timeline?focus=<kind>-<id>`, built by `timelineFocusHref` and parsed by
`parseTimelineFocus` in `utils/timelineFocus.ts`. The calculator's scenario bands and its
rows' card art both link through it; the Timeline resolves the target.

- **Why not a `#hash`.** The Timeline windows its list (ten cards a page, or a growing
  prefix under infinite scroll) and hides past events by default, so the element a browser
  would scroll to is usually not in the DOM. The link therefore *names* a target and the
  route widens its own window to reach it.
- **The id is a `BannerTimeline`**, never the `BannerUma` / `BannerSupport` /
  `BannerStepUp` a planner row points at. Concurrent banners merge into one card, and all
  three row kinds carry the same `banner_timeline` FK, so it is the only id that identifies
  a card from any of them. `rowMatchesFocus` matches a window by **any** banner inside it.
- **Kind-prefixed, because ids are unique only within a model.** `banner` / `scenario` /
  `anniversary`; the latter two are `TimelineMarker["kind"]` verbatim, so neither end needs
  a translation table. Both marker types carry a `sourceId` for this — the primary key,
  held separately from the React `key` rather than parsed back out of it.
- **A malformed value degrades to "no focus".** It comes off the URL, where a user can edit
  or truncate it. Note `Number("")` is `0` and `0` is an integer, so the parser requires a
  *positive* id or `banner-` focuses primary key 0.
- **Resolution is DERIVED, not pushed into state from an effect** — the past/future half
  (`showPastOverride ?? focusIsPast ?? false`), the page, and the revealed prefix
  (`revealCount`). Writing state once the data arrives commits the un-focused list first
  and re-renders over it, which is the same flash `resetListWindow()` exists to avoid.
  Only the `scrollIntoView` is an effect, because it is a genuine DOM side effect —
  and it is guarded, since jsdom implements no `scrollIntoView` at all.
- **The focus scroll is INSTANT, and then re-corrects until the page stops moving.**
  Not a downgrade from the smooth scroll it replaced: `scrollIntoView` fixes its
  destination when called, so anything growing above the target mid-animation leaves it
  short — and because images are lazy, the animation itself drags the viewport past them
  and triggers exactly those loads. It missed by more the further it travelled. Reserved
  art boxes (above) remove the cause; the settle loop — `useFocusScroll`, shared with the
  Selectors page — covers what a declared ratio cannot
  predict — a heading that wraps, a font that swaps, a panel that renders late. It
  re-aligns each frame until the target's `top` holds within `SETTLE_TOLERANCE_PX` for
  `SETTLE_STABLE_FRAMES`, or `SETTLE_TIMEOUT_MS` elapses. **A `wheel`, `touchstart` or
  `keydown` abandons it immediately** — hauling the page back under a reader who has
  taken over is just a different way of losing their place.
- **`revealMore` measures from `revealCount`, not from `visibleCount`.** After a jump the
  state still says 10 while 90 rows are on screen, and `count + 10` would append nothing
  visible for eight scrolls running.
- **Any control that moves or narrows the list clears the parameter** (`clearFocus`, called
  from `goToPage`). The focus target overrides the current page, so holding on to it would
  make "Next" look broken; dropping it also retires the arrival ring
  (`TIMELINE_FOCUS_HIGHLIGHT`) at the moment the reader moves on.
- **A target needs ROWS BELOW IT to be scrollable to the top.** `scrollIntoView` cannot
  scroll past the bottom of a scroller, so a card with nothing under it stays wherever the
  last scroll position leaves it whatever `block` says. `revealCount` therefore adds
  `FOCUS_TRAILING_ROWS` (one whole chunk) *past* the target's own chunk — without it the
  target is always in the LAST revealed chunk, with 0–9 rows beneath it, and the landing
  looks intermittent because it depends on where the target falls inside that chunk.
  Measured live: Project L'Arc (row 44, five rows below) landed correctly; Grand Masters
  (row 19, last of its chunk) did not.
- **`FOCUS_TAILROOM` covers the case revealing cannot** — a target within one
  chunk of the end of the whole list, where there are no more rows to reveal. One screen
  of `dvh` padding, rendered *only* then: permanent padding would put a screen of dead air
  under every timeline, which is worse than the bug. Paged mode keeps a residual limit —
  a page holds ten rows, so a target last on its page has nothing below it and no way to
  reveal more.
- **It lands on the card's TOP (`block: "start"`), not its middle**, offset by
  `FOCUS_SCROLL_MARGIN` (`scroll-mt-6`). Cards are tall — banner art alone is
  ~369px — so centring one put its heading halfway down the screen. The margin goes on
  whichever node carries `focusRef`, which is *not* always the node wearing
  `TIMELINE_FOCUS_HIGHLIGHT`: a banner window rings its panel but scrolls its wrapper, so
  that the campaign strip above the panel comes into view too.
- **One ref for the focused card**, handed to whichever card matches via `TimelineFocusProps`
  — so there is no per-row ref bookkeeping and two cards cannot claim the highlight at once.
  On `BannerWindowCard` the ref goes on the outer wrapper (so scrolling accounts for the
  campaign strip) and the ring on the panel (whose rounding it has to follow).

Covered by `src/__tests__/timelineFocus.test.ts` and the "Timeline deep links" suite.

### Marker cards: scenario launches and campaign openings

`EventMarkerCard` is the timeline's third card, fed by a third `TimelineRow` kind
(`{ kind: "marker" }`) and built by `buildTimelineMarkers` / `mergeTimelineMarkers`.

- **The marker row kind is a FRONTEND union member, not a backend one.**
  `organizedTimelineData` narrows on the backend's `event_type` tag, but
  `AnniversaryEvent.event_type` already means the campaign kind
  (`anniversary` / `new_year` / `campaign`). Tagging markers server-side would collide with
  a shipped field. Key prefixes are `sce-` and `ann-`.
- **`mergeTimelineMarkers` runs AFTER `groupTimelineEvents`**, for the same reason grouping
  runs after filtering: it inserts against the final row order, so running earlier would
  let a marker land inside a window that later folds together.
- **A scenario has no end date and never will** — it stays playable after release. The card
  branches on the *presence* of an end date rather than on the kind, showing
  "Releases &lt;date&gt;" instead of a range. The past/future toggle classifies a scenario by
  its start instant, since it can never be "over".
- **Markers are suppressed under a category filter.** They are cross-cutting context rather
  than banners, so a scenario card stranded in a list of reruns answers a question nobody
  asked — the same reasoning that drops race events there.
- **A missing image is the expected state**, not a degraded one: scenarios get entered
  before the art exists. `BannerArtPlaceholder` is the designed fallback, as with the
  step-up rows in the planner. Build and review the card with no image first.

---

### Deep links from the Timeline to the Selectors page

`/app/selectors?campaign=<AnniversaryEvent id>`, built by `selectorsCampaignHref` and read
by `parseCampaignFocus` in `utils/selectorsFocus.ts`. A timeline banner belonging to a paid
campaign wears an `AnniversaryEventStrip`, whose "Plan purchases" link is the only route
from seeing a campaign to planning what you'd spend at it.

- **The link must NAME its campaign.** It used to be a bare `/app/selectors`, which drops
  the reader at the top of a page listing every upcoming campaign, to find the one they
  just clicked among a stack of near-identical cards.
- **No `kind` prefix, unlike `timelineFocus`.** That module prefixes because the Timeline
  holds three sorts of target and a bare id would be ambiguous between them; this page
  holds exactly one, so a kind would never discriminate anything.
- **A plain `#hash` would not do**, even though this page renders every campaign at once
  with no windowing: the browser acts on a hash only for a document it is loading, not for
  a client-side route change, so the element it names does not exist when it would look.
- **The target legitimately may not be here.** `useSelectorPlanner` drops campaigns whose
  last banner has closed, so a link followed from the Timeline's *past* view resolves to
  nothing. It degrades to the ordinary page, like a malformed timeline focus.
- **Keyed on the resolved INDEX, not the raw id** — campaigns arrive after mount, so the
  id is known one commit before the card it names exists.
- Both pages share `hooks/useFocusScroll` (the instant scroll plus settle loop) and its
  `FOCUS_SCROLL_MARGIN` / `FOCUS_TAILROOM` classes. A second copy would be a second place
  for the two to drift apart.

## Selectors page (`components/selectors/`)

`/app/selectors` is the third nav destination, alongside Calculator and Timeline. It
holds everything about anniversary campaigns: discounted carat packs, selector tickets,
USD budgeting, and the two toggles that govern whether any of it reaches the projection.

- **`Selectors.tsx`** — page root. Zero props, reads `useCalculatorData()`, owns the
  purchase upsert handlers. Follows `UncapCrystalsPanel`'s conventions.
- **`CampaignCard.tsx`** — one campaign: packs with quantity steppers, selectors with a
  target picker, and the per-campaign / cumulative footer.
- **`SelectorTargetPicker.tsx`** — the single-card picker for a selector ticket,
  filtered by that ticket's JP cutoff.
- **`StepUpSelectionStrip.tsx`** — the band below a campaign card's three columns, one
  disclosure row per step-up the campaign sells. It filters `stepUpBannerData` on
  `anniversary_event` and renders nothing when a campaign sells none, so almost every
  card is untouched by it. Each row's thumbnail resolves
  **guaranteed pick → `BannerStepUp.image` → `★3`/`SSR` chip** — the same order the
  planner row uses, so a step-up looks the same in both places.
- **`StepUpSelectionPicker.tsx`** — the ten-slot dialog, laid out like the source
  sheet's own block: the Selection 1–10 columns across the top, the eligible pool as a
  searchable grid beneath. A dialog rather than an inline grid because the campaign card
  is already a dense three-column layout and the 3rd Anniversary cutoff admits hundreds
  of candidates. A pick the cutoff no longer covers is **flagged, never dropped** —
  deleting someone's choice because shared reference data moved is worse than showing
  them it needs revisiting.

An untouched step-up renders a **default selection** — the ten most recently available
cards, most recent starred — labelled `default` on the row and `(default)` in the dialog
so it never passes as a choice the user made. It is virtual until they edit something.
Because that leaves all ten slots full from the outset, a candidate tile that cannot be
picked carries a `title` saying why; "full" is now the state a first-time user meets.
→ `frontend/docs/resource-projection-logic.md` ("The default selection")

**Both pickers share `useEligibleCardCatalogue`** (`hooks/`), which owns the catalogue
rules: candidates come from the calculator's past and upcoming gacha-banner catalogue
rather than a new endpoint, spreadsheet catch-all rows such as `(All)` are excluded,
cards are deduplicated across reruns, filtered inclusively against the cutoff, and sorted
newest-JP-first with a name tiebreak. It was extracted rather than copied — this repo has
twice paid for hand-copied duplicates of exactly that kind.
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

### Every page route sets its own `<head>` tags

This is a single-page app, so `index.html` is served for every URL and React only
replaces `#root`. Nothing updates `<head>` unless a component does it, and before
`useDocumentMeta` all ten routes shared one title and one description.

**A new page route must call `useDocumentMeta(title, description)` as its first
statement**, or it silently inherits whatever the previously visited route set.
Pass `null` as the title only for the homepage, which should read as the site name
rather than "Home | …". The third argument, `noindex`, is for pages that are
plumbing rather than content — `/login` and `/auth/callback` — and those two paths
are also `Disallow`ed in `public/robots.txt`; change one and change the other.

The canonical URL comes from `window.location.origin` at runtime rather than a
build-time constant, so it follows the site across localhost, the DigitalOcean
hostname and the custom domain without config.

**The hook cannot fix link previews.** Discord, Slack, Reddit and Twitter fetch the
raw HTML and never run JavaScript, so they only ever see the static `og:` tags in
`index.html`. Those are a site-wide default; per-route previews would need
prerendering. `index.html` still has no `og:image` — it wants a 1200x630 PNG,
the same branding gap as the stock Vite favicon.

`public/robots.txt` and `public/sitemap.xml` are real static files that Vite copies
to `dist/`, where they match before the DigitalOcean catch-all. Both carry absolute
URLs that **do not survive a domain move** — update them together.
