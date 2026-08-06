# Resource Projection Logic

This document explains the algorithm inside `useBannerResources` (`src/hooks/useBannerResources.ts`) — the core business logic of the calculator. Read this before modifying the hook or adding a new income source.

---

## Overview

The hook takes the user's current resources and planned banner list, then walks forward in time banner by banner. For each banner it accumulates every income source that fires between the previous banner's end date and this banner's end date, then records a snapshot of resources at that point. After the snapshot, it deducts the pull cost for that banner so the next banner's calculation starts from the correct balance.

The output is an array of `BannerResources` objects — one per planned banner, in order — each containing the carats, uma tickets, and support tickets the user will have available on that banner's end date.

---

## Step-by-Step Algorithm

### Initialization

```
freeCarats     = current_carat        // earned carats — receive nearly ALL income
paidCarats     = current_paid_carat   // purchased carats — grow only from the Daily Carat Pack
umaTickets     = uma_ticket
supportTickets = support_ticket
lastEndDate    = startOfDay(today)   // local midnight, computed once
results        = []
```

Carats are tracked as **two balances**. Every income source in the steps below accrues to
`freeCarats` (the pseudocode writes `carats +=` for brevity, but it means `freeCarats`) —
with two exceptions, both of them purchased currency: the Daily Carat Pack's 500-carat
purchase bonus (step 5) and 350 of the paid Training Pass's 2,200 monthly carats (step 9).
Those are the only income that credits `paidCarats`; otherwise it only *decreases*, and only
when pulls are paid for (step 11). The two are combined solely for the displayed snapshot
total (step 10). This split is what powers the "discounted paid pulls" strategy, which draws
exclusively from `paidCarats`.

`lastEndDate` is anchored to the **start of today (local midnight)**, computed a single time. It is deliberately *not* a live `new Date()`: every recompute (adding/removing a banner, editing a stat, an autosave round-trip) would otherwise capture a slightly later instant, and any in-progress event's front-loaded `carats_throughout` — the only fractional income source — would have decayed a few more seconds, drifting the estimates downward by a fraction of a carat each time. A stable start-of-day makes all recomputes on the same calendar day produce identical numbers.

### Walk order vs. display order

These are two different orderings, and conflating them was a real bug.

The planned banner list is sorted by timeline **start date** — server-side by `GET /calculator-data`, and again client-side when a banner is added or changed. That is the *display* order: rows appear in the order banners open.

The loop below is a single pass down the calendar carrying one cursor (`lastEndDate`), where each banner is a checkpoint keyed on its **end date**. A date cursor can only move forward — that is what makes the windows tile — so the checkpoints must be visited in ascending *end*-date order.

Those two orderings differ whenever a short banner is nested inside a longer one (it opens later but closes sooner). The live schedule contains 14 such pairs. So the hook sorts a copy of the list by end date for the walk, and writes each result back into that banner's **display slot**. Nothing about the on-screen ordering changes.

The walk comparator states its ordering explicitly, in three keys:

1. **End day** ascending — the calendar order the cursor has to follow.
2. **Start day** ascending — on a shared closing day the banner that *opened first* is checkpointed first, so its estimate is never charged for pulls committed to a banner that opened after it. A banner with no resolvable start sorts last.
3. **Display position** — uma/support pairs share one timeline, so both keys above tie and the row listed first keeps spend priority.

> **Compare closing *days*, not closing instants.** An earlier version sorted on `endDate.getTime()` and relied on `Array.prototype.sort` stability to keep same-end-date banners in display order. That guarantee never fired for predicted banners, because their end dates are not equal — only their *rendered* dates are. The backend derives predicted dates as `anchor + jp_gap * PREDICTION_FACTOR` (`backend/calculatorapi/predictions.py`), a float times a `timedelta`, so each lands on an arbitrary time of day — `2028-10-20T07:24:28.800000Z` next to a confirmed row's clean `21:59:59`. `formatDate` prints local `Y/M/D` only, so the sheet shows one date for both while `getTime()` puts them hours apart, and a banner that merely drew an earlier time of day spent first. Quantising both sort keys with `startOfDay` (local, matching `formatDate`) is what makes "same end date" actually tie.

Only the *visit order* is day-quantised; every window still uses the raw `endDate` instant. The consequence is that two checkpoints on the same day can be visited slightly out of instant order, so the second opens a backwards window. Every income helper already clamps those to zero (`if (end <= start) return 0`), the cursor guard keeps `lastEndDate` from retreating, and the `carats_throughout` delta is floored at 0 so a backwards step cannot refund carats already credited.

---

### Per-Banner Loop

For each banner, in ascending end-date order:

**1. Determine the cutoff date**

The cutoff is the banner's `end_date` (from its `banner_timeline`). Resources earned right up to when the banner closes are counted. A banner with no resolvable end date keeps a zeroed result slot (it is not skipped, which would shift every later row's result onto the wrong card).

> Note: `end_date` is the **resolved** global date — the confirmed date when available, otherwise a date predicted from the JP schedule by the backend (`is_predicted: true`). The projection treats both identically; only the display shows an "Estimated" badge for predicted dates.

**2. Add game event rewards**

`GameEvent` reward amounts fall into two categories, both handled per event in this step.

**Immediate amounts.** For every `GameEvent` whose `start_date` is strictly after `lastEndDate` and on or before `endDate`:
```
carats         += event.carat_amount
umaTickets     += event.uma_ticket_amount
supportTickets += event.support_ticket_amount
```
SR/SSR shards and crystals are received but the projection does not currently track those balances.

**Throughout amounts.** Independent of `start_date`, every event also contributes a *front-loaded* share of `carats_throughout` — rather than a flat rate, more of the pool is credited earlier in the event's life, tapering off toward `end_date` (where it reaches exactly 100% earned). `getThroughoutCaratsInWindow` (in `utils/incomeCalculationUtils.ts`) computes this via a `remainingShare(t)` helper — the fraction of the pool still uncredited at instant `t` — evaluated at both edges of `[lastEndDate, endDate]`:
```
carats += event.carats_throughout × (remainingShare(lastEndDate) − remainingShare(endDate))
```
`remainingShare` blends a fast exponential decay (`k=2`, dominant for roughly the first ~17% of the event) with a slower linear decay (`slope=0.8`, dominant for the rest) — see the JSDoc on `remainingShare` for the exact formula. For example, a 10-day, 1000-carat event earns ~210 carats in just the first day, and the full 1000 only at the very end of day 10 — there's no early cutoff or dead zone; the last day of the event still earns carats.

This composes correctly across a chain of banners — an event spanning a banner boundary has its `carats_throughout` split according to the decay curve between them (front-loaded onto the earlier banner) rather than credited all-or-nothing to whichever banner's window happens to contain a single reward date.

**3. Add Champions Meeting payouts**

For every `ChampionsMeeting` whose `end_date` falls in the same window:
```
carats += user's ChampionsMeetingRank.income_amount
```

**3b. Add League of Heroes payouts**

For every `LeagueOfHeroes` whose `end_date` falls in the same window:
```
carats += user's LeagueOfHeroesRank.income_amount
```

**4. Calculate the time span**

```
days    = countDaysInWindow(lastEndDate, endDate)      // half-open, start excluded
mondays = count of Mondays in (lastEndDate, endDate]   // half-open, start excluded
months  = count of 1st-of-month boundaries crossed
```

> **Windows are half-open: `(lastEndDate, endDate]`.** The start day is excluded, the end day included. This matters because banner windows are contiguous — one banner's `endDate` is the next banner's `lastEndDate`. If both endpoints were counted, that shared boundary day would be tallied twice (once as the earlier window's last day, once as the next window's first day), so every added banner would inflate all downstream totals by ~a day's income and every removed banner would deflate them. Half-open windows tile perfectly — `(a,b] ∪ (b,c] = (a,c]` — so totals are independent of how many banners the timeline is sliced into. `countDaysInWindow`, `calculateDailyIncome` and `calculateMondaysBetween` all drop the start day to match.

> **Do not use `differenceInDays` for a per-day count here.** It measures *elapsed 24-hour spans* and truncates the remainder, which is only equivalent to a calendar-day count when both endpoints share a time of day. Banner windows almost never do: the cursor starts at local midnight while timelines end at `21:59:59Z`-style instants. Because the truncation happens per window it does **not** tile — chaining `(a,b]` and `(b,c]` loses up to a day at each internal boundary. This was a live bug in the Daily Carat Pack's drip: a 12-banner plan came out 250 carats short of the same projection computed as one window, a 30-banner plan 750 short, and deleting a row merged two windows and handed a truncated day back, so every downstream estimate jumped by 50. `countDaysInWindow` counts day boundaries instead, which is additive by construction, and floors at 0 so a backwards window can never subtract income.

**5. Add Daily Carat Pack income** (if enabled)

```
freeCarats += 50 * days                              // the daily drip — earned carats
paidCarats += 500 * calculateIntervalOccurrences(windowStart, windowEnd, today, 30)
```

The pack pays in two currencies. The **50/day drip** is ordinary earned income, so it lands
in `freeCarats` like everything else. The **500-carat purchase bonus** is bought with money,
so it lands in `paidCarats` — the only income source that does, and therefore the only thing
that keeps discounted paid pulls funded on a long horizon.

The bonus uses the same rolling-cycle machinery as the 50-Day Login Bonus (step 6b):
anchored to `today`, so the first payout is the day-30 repurchase, then day 60, day 90, … A banner ending
inside the first 30 days gets none of it. Day 0 never pays out — the pack the user holds right
now is assumed already counted in the `current_paid_carat` they entered. Because the payout
instants are absolute rather than relative to each window, the totals tile: slicing a timeline
into more banners can't inflate them.

**6. Add Club Rank payout**

```
carats += ClubRank.income_amount * months
```

**6b. Add Misc Earnings + 50-Day Login Bonus + annual gifts**

```
if misc_earnings:
    // toggle-gated, 60 per day for every day past a 30-day ramp-in from today
    freeCarats += MISC_EARNINGS_PER_DAY *
                  countDaysAfterDelay(windowStart, windowEnd, today, 30)

// always on, 150 per completed 50-day cycle counted from today
freeCarats += FIFTY_DAY_LOGIN_PER_CYCLE *
              calculateIntervalOccurrences(windowStart, windowEnd, today, 50)

// always on, 500 on every February 14 in the window
freeCarats += VALENTINES_CARATS *
              calculateAnnualDateOccurrences(windowStart, windowEnd, 1, 14)

// always on, 500 on every March 14 in the window
freeCarats += WHITE_DAY_CARATS *
              calculateAnnualDateOccurrences(windowStart, windowEnd, 2, 14)
```

**Misc Earnings** (gifts / Team Trials extras / careers) mirrors the source sheet's figure
and is gated behind the user's `misc_earnings` toggle (on by default, surfaced in the
navbar Settings menu). It does **not** use the `months` count, and it does not arrive in
lumps: after a 30-day ramp-in counted from `today` it credits 60 carats **every day**. A
banner ending inside the ramp-in gets nothing. `countDaysAfterDelay` clamps each window's
start forward to the absolute instant `today + 30` before counting days, which is what
makes it tile — `(a,b] ∪ (b,c]` credits exactly what `(a,c]` would, wherever the ramp-in
boundary falls, so planning more banners never changes the total.

> The drip replaced an 1,800-per-30-days lump. Same long-run rate (60 × 30 = 1,800) and the
> same treatment the source sheet uses, but without the sawtooth: a banner's estimate no
> longer jumps by 1,800 when its end date crosses a cycle boundary.

The **50-Day Login Bonus** is universal login-campaign income with no toggle. It *does*
pay in lumps, on a rolling 50-day cycle anchored to `today` via
`calculateIntervalOccurrences`: first payout on day 50, nothing credited before then.

The **annual gifts** — Valentine's Day (500 on February 14) and White Day (500 on March 14)
— are universal too, but they are fixed calendar dates rather than rolling cycles, so they
use `calculateAnnualDateOccurrences` — the annual analogue of the 1st-of-month counting.
Their payout instants are absolute calendar dates, which gives them the same tiling
property: a February 14 landing exactly on a banner boundary is credited by one window,
never both. The month argument is 0-indexed to match `Date.getMonth()`, so `1` is February
and `2` is March. See `backend/docs/income-calculation.md` for where White Day's 500 is
derived from — the source sheet does not expose it as a settings cell.

**6c. Add Monthly Shop Tickets** (if enabled)

```
if monthly_shop_tickets:
    shopMonths      = calculateDayOfMonthOccurrences(start, end, 2)
    umaTickets     += 4 * shopMonths
    supportTickets += 4 * shopMonths
```

The in-game monthly shop bundle (4 uma + 4 support tickets) is bought with an untracked
currency, so it's credited at no carat cost. Off by default. It stocks on the **2nd** of
each month, so it counts its own day-of-month occurrences rather than reusing `months`
(the 1st-of-month count Club Rank uses) — a banner ending on the 1st would otherwise be
credited a bundle the player can't buy yet.

**7. Add Team Trials payout**

```
carats += TeamTrialsRank.income_amount * mondays
```

**8. Add base daily income**

Iterates every day in the half-open window (every day *after* `lastEndDate`, through `endDate`) and adds:
- 75 carats (base, every day)
- +25 bonus every day where `daysSinceReference % 7 === 0` (first day of each week)
- +25 bonus every day where `daysSinceReference % 7 === 3`
- +25 bonus every day where `daysSinceReference % 7 === 5`
- +75 bonus every day where `daysSinceReference % 7 === 6` (last day of each week)

**9. Add Training Pass payout (carats and tickets)**

The Training Pass feature (both paid and free tiers) does not exist until **August 15, 2027**. No income is added for any window that ends before that date.

For windows that extend past August 15, 2027, the calculation is clamped so only the post-launch portion counts. Carats are **either/or** (the paid reward replaces the free tier's), while tickets are **base + bonus** (the paid pass stacks on top of the free tier) and always land on the 24th.

The paid tier's 2,200 carats are also **split across both balances** — 1,850 free and 350 paid — because part of the reward is purchased currency (same idea as the Daily Carat Pack's repurchase lump in step 3). The free tier's 500 is entirely free carats:

```
passStart  = max(lastEndDate, August 15 2027)
rewardDays = occurrences of the 24th of the month in [passStart, endDate]

if training_pass:
    freeCarats += 1850 * rewardDays
    paidCarats +=  350 * rewardDays   # 2,200 total
else:
    freeCarats += 500 * (month boundaries crossed in [passStart, endDate])

umaTickets     += rewardDays * (2 + (training_pass ? 2 : 0))
supportTickets += rewardDays * (2 + (training_pass ? 2 : 0))
```

Both this step and the equivalent one in `useAverageMonthlyIncome` call the shared
`getTrainingPassIncome(windowStart, windowEnd, hasPaidPass)` helper in
`utils/incomeCalculationUtils.ts`, which owns the launch-date gate and both schedules.

Note that a free-tier account draws its carats on the 1st but its tickets on the 24th — the pass resets as a unit, so the tickets follow the pass's own reward day regardless of tier.

**10. Record the snapshot**

```
results.push({
    carats: freeCarats + paidCarats,   // combined total
    freeCarats,                        // "Carat Est." box
    paidCarats,                        // "Paid Carat Est." box
    maxPossiblePulls,                  // greedy max under the pull strategy
    maxPullBreakdown,                  // "Free/Tickets/Paid" box
    umaTickets,
    supportTickets,
})
```

`carats` is the combined total — resources available at banner end. The row does **not**
display it: `freeCarats` and `paidCarats` are shown as two separate boxes ("Carat Est."
and "Paid Carat Est.", matching the source spreadsheet's wording), because the two behave
differently and only paid carats can buy discounted pulls. `carats` is kept because it is
the projection's headline figure and what the test suite pins.

`maxPossiblePulls` is the "Max Pulls" figure: the most pulls this banner could support if
*all* available resources were thrown at it (computed by the same strategy as the actual
spend, see step 11).

`maxPullBreakdown` decomposes that figure by funding source — `{ freePulls, tickets,
paidPulls, freeCaratPulls }` — and the row shows the first three as `Free/Tickets/Paid`.
Two things to know about it:

- **`paidPulls` covers every pull paid for with paid carats**, not just discounted ones:
  the discounted pulls plus the *marginal* share of full-price pulls. Full-price pulls
  draw on a deliberately fungible free+paid pool (step 11), so the paid share is defined
  as `fullPriceMaxPulls - floor(freeCarats / 150)` — the pulls that exist only because
  paid carats were in the pool. That rule follows the spend order, which puts free carats
  ahead of full-price paid carats, so the boundary pull lands in the paid bucket.
- **Under a carat deficit the four parts can sum to more than `maxPossiblePulls`.** Each
  part is clamped at 0 while the total keeps its own clamp. That is intentional — free
  pulls and tickets really do remain available; the deficit is a carat debt.

**11. Deduct pull cost** (`applyPullStrategy` in `utils/bannerHelpers.ts`)

The banner's `free_pulls` are subtracted first, then the remaining pulls are paid in this
order — the single source of truth for both the actual spend and `maxPossiblePulls`:

1. **Matching tickets** (uma tickets for uma banners, support tickets for support banners).
2. **Discounted paid pulls** *(if `discounted_paid_pulls`)*: 50 `paidCarats` per pull, capped
   at one pull per day of the banner's window and by the paid balance — the discount stops the
   instant `paidCarats` can't cover another 50. The day cap counts **inclusive local calendar
   days** across the whole window:

   ```js
   differenceInDays(startOfDay(endDate), startOfDay(bannerStart)) + 1
   ```

   The anchor is the banner's **start**, not `today`, even for a banner that is already live.
   Clamping to `today` shrank the cap by one every elapsed day, so a plan tuned on the banner's
   opening day drifted into "unaffordable" a few days later and had to be re-tuned mid-banner.
   Window length is a fixed property of the banner, so the allowance — and the `maxPossiblePulls`
   built on it — now holds still for as long as the banner is on screen. The trade-off is that a
   banner whose window has already **closed** still reports its full allowance rather than zero;
   it is unpullable anyway, and the app doesn't model expiry anywhere else.

   The inclusive counting matters too. Banner windows are stored as `<start>T22:00:00Z` → `<end>T21:59:59Z`, and
   the discount is claimable on the opening and closing days even though both are partial. A
   bare `differenceInDays(endDate, bannerStart)` undercounted by **two**: it measures the gaps
   between days rather than the days themselves, and it then truncated again because the window
   is one second short of a whole number of days (a Sep 10 → Sep 22 banner scored 11, not 13).
   Flooring to local midnight removes the truncation; the `+ 1` makes the range inclusive.
   Local days are used deliberately — the banner card renders Start/End in local time, so the
   cap matches the dates a user can count on screen.
3. **Free carats** at 150 each.
4. **Full-price paid carats** at 150 each *(only if `full_price_paid_pulls`, the default)*.

Free carats are spent before full-price paid carats so more daily discounts remain for later
banners. Full-price pulls treat free + (enabled) paid carats as one fungible pool (remainders
combine, so with the default toggles this reproduces the old single-pool math exactly). Any
pulls that still can't be paid for become a **negative `freeCarats`** balance — the UI
surfaces this as an unaffordable plan, and it cascades to later banners.

**12. Advance the window**

```
lastEndDate = endDate
```

The next banner's income window starts from here.

---

## Key Invariants

- **Income is cumulative across banners.** Resources carry over; the loop never resets `freeCarats`, `paidCarats`, `umaTickets`, or `supportTickets` to zero between banners.
- **Free vs paid carats are tracked separately.** All income accrues to `freeCarats` except the two purchased sources — the Daily Carat Pack's 500-carat purchase bonus and 350 of the paid Training Pass's monthly 2,200 — which are the only growth `paidCarats` sees; otherwise it only decreases (via pulls). They combine only for the displayed total. This split is required for discounted paid pulls (paid-only) and for the `full_price_paid_pulls` reserve behavior. A shortfall lands on `freeCarats` (goes negative) rather than paid.
- **Windows are half-open `(lastEndDate, endDate]`.** The start day is excluded so adjacent banner windows don't double-count their shared boundary day. Totals therefore don't depend on how many banners the timeline is split into — guarded by the "banner count invariance" tests.
- **The projection is anchored to a stable start-of-today.** Recomputes on the same calendar day are deterministic; there is no per-recompute time drift.
- **`carats_throughout` is front-loaded, not a flat rate.** More of an event's throughout-carat pool is earned early in its life than late — see `remainingShare` in `utils/incomeCalculationUtils.ts`.
- **The cutoff is `end_date`, not `start_date`.** A banner starting April 1 and ending April 14 captures income through April 14. The resources shown are what you'll have at the end of that banner's run.
- **Uma tickets only offset uma banner pulls; support tickets only offset support banner pulls.** There is no cross-ticket substitution.
- **The walk visits checkpoints in ascending end-date order; results are returned in display order.** The display list is sorted by timeline *start* date, which is not the same ordering when a short banner is nested inside a longer one. The hook sorts a copy by end date for the walk and writes each result back to its banner's display slot, so `bannerResources[i]` always belongs to `userPlannedBannerData[i]`. Walking in display order gave nested banners a backwards window, so they collected nothing and reported the *previous* banner's later balance — overstating one real case by ~2,300 carats.
- **On a shared closing day, the banner that opened first spends first.** The walk comparator is `end day → start day → display position`, all quantised to local days with `startOfDay`. Comparing raw end *instants* instead let a predicted banner that drew an earlier time of day spend first and charge its pulls to a banner that had opened weeks earlier — the two rows read as the same date on screen, so the deduction looked like it came from nowhere.
- **A banner's estimate depends only on its own end date**, never on its position in the list or on how many other banners are planned (given the same spending ahead of it). Guarded by the "walk order" and "banner count invariance" tests.

---

## Adding a New Income Source

1. Add the income data to the `GET /calculator-data` response and to `BannerResourcesParams`.
2. Insert the accumulation step inside the per-banner loop (steps 2–9 above), in the correct position relative to the cutoff date check.
3. Update `backend/docs/income-calculation.md` with the game mechanic, amounts, and schedule.
4. Add the new param to the `useMemo` dependency array at the bottom of the hook.
