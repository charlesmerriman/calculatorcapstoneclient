# Resource Projection Logic

How the calculator turns a user's resources and planned banners into the numbers
on each row. Read this before touching the maths.

One engine, the ledger engine, entered at `hooks/useBannerResources.ts` (the
per-banner rows) and `hooks/useAverageMonthlyIncome.ts` (the "Income & Resources"
tiles). Both read the same ledger, so the rows and the tiles above them cannot
disagree — a user sees both at once, and that agreement is now structural rather
than a rule to remember.

A legacy windowed walk shipped alongside it behind `USE_INCOME_ENGINE_V2` until
2026-08-18, when it was deleted along with the flag and the per-window occurrence
helpers in `utils/incomeCalculationUtils.ts`. The section below is why.

---

## The model

> Build one flat, dated timeline of every reward. Then, for each banner, ask that
> timeline for the **total income from today up to that banner's end date**, and
> subtract what the banners resolving earlier already spent.

That is what the source spreadsheet does, and matching it is why the rewrite
happened.

### Why the walk was replaced

The legacy engine stepped a cursor banner to banner, accruing income into chained
half-open `(prevEnd, thisEnd]` windows. Every income source needed its own
occurrence counter, and every counter had to **tile** — `(a,b] + (b,c] === (a,c]`
— or totals drifted with how many banners the user happened to plan.

Tiling is a property you have to prove separately for each counter and can lose
silently. Losing it was the root cause of a long run of drift bugs against the
sheet: the Daily Carat Pack losing a day per window, misc earnings sawtoothing
0..+1,800, the throughout-carat model wandering between +1,164 and +9,643. Each
was found and fixed individually.

A closed form measured from a fixed anchor has nothing to lose. **Income is now a
pure function of a banner's end date** — nothing about the rest of the plan
reaches the calculation.

### The consequence worth internalising

Banner order no longer affects income at all. It only decides **who has already
spent** by the time a given banner is reached. So the sheet's "self-join over the
other banner rows" is still implementable as a single forward pass carrying a
running spend total — it just stops carrying income.

---

## Where each piece lives

| Module | Responsibility |
|---|---|
| `backend/calculatorapi/ledger.py` | Builds the flat dated timeline; served as `income_ledger` |
| `utils/utcDates.ts` | `DATEDIF` / `EOMONTH` / `WEEKDAY` / `CEILING` equivalents, in UTC |
| `utils/cumulativeIncome.ts` | One closed form per income source |
| `utils/incomeLedger.ts` | Queries over the ledger (event lumps, race counts, throughout decay) |
| `hooks/useBannerResources.ts` | The engine: income − spend, per banner |
| `utils/bannerHelpers.ts` | `applyPullStrategy`, `allocateReservedCopies` — **unchanged by the rewrite** |

Every function in the first three names the spreadsheet cell it reproduces.
Where we knowingly differ, the comment says so.

---

## The pass

```
today = midnight UTC          // the sheet's $AG$3 (TODAY) — measures spans
now   = the live instant      // the sheet's $AG$2 (NOW)  — filters reward instants

sort banners by (start day, display position)
spent = { free, paid, umaTickets, supportTickets, ssrCrystals } = 0

for each banner:
    E        = its end date
    income   = cumulativeIncome(today, now, E)     // absolute, order-independent
    free     = startingFree + income.free - spent.free
    paid     = max(0, startingPaid + income.paid - spent.paid)
    strategy = applyPullStrategy(...)              // unchanged
    reserved = allocateReservedCopies(...)         // unchanged
    results[displayIndex] = snapshot(...)
    spent += (pre-spend balance − post-spend balance)
```

**The two anchors are not interchangeable.** `today` measures spans, so every
estimate on a given calendar day is identical no matter when the page is opened.
`now` filters reward instants: an event that already opened today has paid out,
and its carats are in the balance the user typed in — counting them again would
double them.

**Ordering.** Keyed on the banner's start day, which is the sheet's `AH44`. The
sheet implements the tiebreak by nudging duplicate start dates forward a day
each; sorting by `(start day, display position)` is the same ordering without the
artifact that a nudged banner can collide with one genuinely starting the next
day.

**Results are written to each banner's display slot**, so `bannerResources[i]`
always belongs to `userPlannedBannerData[i]` regardless of pass order.

---

## Income sources

Each is a closed form from `today` to the banner's end date `E`.

| Source | Rule | Sheet |
|---|---|---|
| Daily quests + weekly login | `CEILING(days × (base + weekly/7), 10)` — a **blended** rate | `AN42` |
| Team Trials | Complete weeks since the Monday of the current week | `AO42` |
| Club Rank | Complete months since the 1st of the current month | `AP42` |
| Training Pass | Complete months since launch; carats either/or, tickets base + bonus | `AQ42`/`BA42`/`BH42` |
| Daily Carat Pack | Daily drip (free) + a lump per cycle (paid) | `AR42`/`AZ42` |
| Champions Meeting / LoH | Count of ledger rows × the user's rank payout | `AS42`/`AT42` |
| 50-day login + Valentine's + White Day | Completed cycles, plus each gift the window reaches | `AU42` |
| Misc earnings | Daily drip after a ramp-in; **monthly** figure ÷ 30 | `AV42` |
| Event lump rewards | Ledger rows with `now ≤ date ≤ E` | `AL42` |
| Throughout carats | Decay curve, evaluated once from today | `AL43` |
| Campaign purchases | Paid carats, credited at the campaign's resolved start | `AM42`/`AY42` |

**The daily rate is blended, not day-by-day.** The legacy engine walked each day
and added the bonus on specific weekdays, phased off `today`. Same long-run rate,
but a different figure for any given banner — and it made every estimate depend
on which weekday the user opened the page.

**Complete months, not month boundaries crossed.** `DATEDIF(a, b, "M")` only
completes a month when the day-of-month comes round again: Jan 31 → Feb 28 is
**0**. Measuring from the 1st is what makes that agree with the old
boundary-crossing count.

**Everything is UTC.** The legacy engine mixed local (`startOfDay`,
`eachDayOfInterval`) with UTC (the throughout curve only). The sheet is UTC
throughout — its anchor cell is literally labelled "Today's Date UTC" — and a
local reading makes estimates depend on the viewer's timezone.

---

## The ledger

A flat, date-sorted row per reward instant, built server-side from `GameEvent`,
`ChampionsMeeting` and `LeagueOfHeroes`. See `backend/docs/api-reference.md`
(`IncomeLedgerRow`) for the field-by-field contract. Four things matter here:

- **`date` is when the reward lands** — an event's start, a race event's **end**.
- **Race rows carry no amounts.** They are indicators; what a placement pays
  depends on the user's rank, which only the client knows.
- **`throughout_end` is the linked banner's end**, with the game-event buffer
  already removed, because the decay curve runs over the banner rather than the
  event. The client no longer keeps its own copy of that constant.
- **No row is filtered by "today" server-side.** The ledger is a set of dated
  facts; the projection applies `today < date ≤ E` client-side so the whole
  calculation shares one anchor.

### The throughout curve

An event's `carats_throughout` is a *pool*, not a lump. The curve blends a fast
exponential early decay with a slower linear tail, taking whichever leg has more
left — so it front-loads just after a banner opens and tapers after.

It is evaluated **once, from today**, and the result credited whole to a single
banner. An earlier model spread each pool across every banner window it
overlapped, which made a banner's estimate depend on how the user had sliced
their plan.

> The curve's shape (`throughout_decay_k`, `throughout_decay_linear_slope`) and
> its two offsets are admin-editable. `ceilToTen` exists because the sheet's
> `CEILING(..., 10)` is what its published figures are rounded to, and matching a
> specific banner's 1,120 exactly is what confirmed the rest of the model.

---

## Constants

Every tunable number comes from `GET /calculator-data`'s `calculation_constants`
key, editable in Django admin under **Configuration → Calculation constants**.
The engine takes them **as a parameter** — importing them at module scope would
freeze them at build time, defeating the point.

`DEFAULT_CONSTANTS` in `constants/gameConstants.ts` is the fallback when the key
is absent (fresh database, older API, a deploy where the two sides are briefly
out of step). The provider overlays server values on top of it, so a constant the
API doesn't know about yet keeps its default rather than arriving `undefined` and
turning every downstream total into `NaN`.

Two shape differences between the wire format and the legacy constants, handled
at the boundary: months are **1-indexed** (as a human editing the admin page
expects, not `Date.getMonth()`'s 0-indexed), and misc earnings is a **monthly**
figure dripped as `monthly / 30`.

---

## Invariants

- **A banner's income depends only on its end date** — not its position, not how
  many other banners are planned. This replaces the legacy engine's "banner count
  invariance" and is strictly stronger.
- **Free and paid carats are tracked separately.** Paid is floored at 0; free
  absorbs any shortfall and goes negative, which is what the row's red state
  reads. Only paid carats fund discounted pulls.
- **Overplanning is reported, not clamped** — the debt cascades to later banners.
- **Uma tickets only offset uma pulls; support tickets only support pulls.** No
  cross-substitution.
- **Selector tickets are banked up front**, outside the pass, and never fund a
  pull. A selector isn't spent at a banner — it takes a card from the back
  catalogue, which stays available after its banner ends. What constrains it is
  its **cutoff**, which is calendar-independent. They are a bucketed pool
  (`{ jpCutoff, count }[]`), not a scalar: two tickets with different cutoffs are
  different resources, and spending takes the *weakest qualifying* one.
- **A selector only has to reach ONE card on a banner.** The engine derives
  `oldestFeaturedJpDate`; gating on the newest let a single recent unit make a
  whole multi-uma banner read as unfundable.
- **Reserved copies change the odds, not the pull maths.** Selectors first, then
  SSR crystals; uma banners can only use selectors (no ★3 crystal in this data
  model). Over-reserving is reported via `reservedFunding.unfunded`.

## Adding a new income source

1. If it's event-driven, add it to `backend/calculatorapi/ledger.py` and the
   serializer; if it's a rate or schedule, add a field to `CalculationConstants`.
2. Add a closed form to `utils/cumulativeIncome.ts` (or a query to
   `utils/incomeLedger.ts`), naming the sheet cell it reproduces.
3. Call it from `incomeTo()` in `useBannerResources` **and** from
   `useAverageMonthlyIncome` — unless it is one-off rather than recurring
   (campaign purchases are the standing exception; averaging them would report a
   recurring income nobody earns).
4. Update `backend/docs/income-calculation.md`.

There is no longer a tiling requirement to satisfy — that was the old engine's
step 7 and the source of most of its bugs.

## Sheet parity

The numbers are not yet confirmed to match the spreadsheet end to end. The
harness and the remaining known differences are documented in the `sheet-parity`
skill (`.claude/skills/sheet-parity/SKILL.md`); the fetcher is
`backend/scripts/fetch_sheet_parity_snapshot.py`.
