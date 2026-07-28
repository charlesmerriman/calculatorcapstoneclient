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
freeCarats     = current_carat        // earned carats — receive ALL income
paidCarats     = current_paid_carat   // purchased carats — never grow
umaTickets     = uma_ticket
supportTickets = support_ticket
lastEndDate    = startOfDay(today)   // local midnight, computed once
results        = []
```

Carats are tracked as **two balances**. Every income source in the steps below accrues to
`freeCarats` (the pseudocode writes `carats +=` for brevity, but it means `freeCarats`).
`paidCarats` only ever *decreases*, and only when pulls are paid for (step 11). The two are
combined solely for the displayed snapshot total (step 10). This split is what powers the
"discounted paid pulls" strategy, which draws exclusively from `paidCarats`.

`lastEndDate` is anchored to the **start of today (local midnight)**, computed a single time. It is deliberately *not* a live `new Date()`: every recompute (adding/removing a banner, editing a stat, an autosave round-trip) would otherwise capture a slightly later instant, and any in-progress event's front-loaded `carats_throughout` — the only fractional income source — would have decayed a few more seconds, drifting the estimates downward by a fraction of a carat each time. A stable start-of-day makes all recomputes on the same calendar day produce identical numbers.

The planned banners are already sorted by timeline start date by the server (the `GET /calculator-data` endpoint annotates and orders by timeline date).

---

### Per-Banner Loop

For each banner in the sorted list:

**1. Determine the cutoff date**

The cutoff is the banner's `end_date` (from its `banner_timeline`). Resources earned right up to when the banner closes are counted. If no end date exists the banner is skipped.

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
days    = differenceInDays(endDate, lastEndDate)
mondays = count of Mondays in (lastEndDate, endDate]   // half-open, start excluded
months  = count of 1st-of-month boundaries crossed
```

> **Windows are half-open: `(lastEndDate, endDate]`.** The start day is excluded, the end day included. This matters because banner windows are contiguous — one banner's `endDate` is the next banner's `lastEndDate`. If both endpoints were counted, that shared boundary day would be tallied twice (once as the earlier window's last day, once as the next window's first day), so every added banner would inflate all downstream totals by ~a day's income and every removed banner would deflate them. Half-open windows tile perfectly — `(a,b] ∪ (b,c] = (a,c]` — so totals are independent of how many banners the timeline is sliced into. `differenceInDays` already has this half-open count; `calculateDailyIncome` and `calculateMondaysBetween` drop the start day (`.slice(1)`) to match.

**5. Add daily carat bonus** (if enabled)

```
carats += 50 * days
```

**6. Add Club Rank payout**

```
carats += ClubRank.income_amount * months
```

**6b. Add Misc Earnings + 50-Day Login Bonus** (flat approximations)

```
if misc_earnings:
    // toggle-gated, 1800 per completed 30-day cycle counted from today
    freeCarats += MISC_EARNINGS_PER_CYCLE *
                  calculateIntervalOccurrences(windowStart, windowEnd, today, 30)
freeCarats += FIFTY_DAY_LOGIN_PER_MONTH * months     // always on, ~170
```

**Misc Earnings** (gifts / Team Trials extras / careers) mirrors the source sheet's figure
and is gated behind the user's `misc_earnings` toggle (on by default, surfaced in the
navbar Settings menu). It does **not** use the `months` count: it accrues over a rolling
30-day cycle anchored to `today`, so the first payout lands on day 30 (a banner ending
before then gets nothing) and one more lands every 30 days after. Anchoring the schedule
to `today` instead of to each window's start is what makes it tile — `calculateIntervalOccurrences`
counts absolute payout instants, so `(a,b] ∪ (b,c]` credits exactly what `(a,c]` would,
and planning more banners never inflates the total.

The **50-Day Login Bonus** is universal login-campaign income with no toggle, still
credited on month boundaries — the same `months` count as Club Rank.

**6c. Add Monthly Shop Tickets** (if enabled)

```
if monthly_shop_tickets:
    umaTickets     += 4 * months
    supportTickets += 4 * months
```

The in-game monthly shop bundle (4 uma + 4 support tickets) is bought with an untracked
currency, so it's credited on month boundaries at no carat cost. Off by default.

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

For windows that extend past August 15, 2027, the calculation is clamped so only the post-launch portion counts. Carats are **either/or** (the paid reward replaces the free tier's), while tickets are **base + bonus** (the paid pass stacks on top of the free tier) and always land on the 24th:

```
passStart  = max(lastEndDate, August 15 2027)
rewardDays = occurrences of the 24th of the month in [passStart, endDate]

if training_pass:
    carats += 2200 * rewardDays
else:
    carats += 500 * (month boundaries crossed in [passStart, endDate])

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
    carats: freeCarats + paidCarats,   // combined total for display
    maxPossiblePulls,                  // greedy max under the pull strategy
    umaTickets,
    supportTickets,
})
```

`carats` is the value the UI displays for this banner — resources available at banner end.
`maxPossiblePulls` is the "Max Pulls" figure: the most pulls this banner could support if
*all* available resources were thrown at it (computed by the same strategy as the actual
spend, see step 11).

**11. Deduct pull cost** (`applyPullStrategy` in `utils/bannerHelpers.ts`)

The banner's `free_pulls` are subtracted first, then the remaining pulls are paid in this
order — the single source of truth for both the actual spend and `maxPossiblePulls`:

1. **Matching tickets** (uma tickets for uma banners, support tickets for support banners).
2. **Discounted paid pulls** *(if `discounted_paid_pulls`)*: 50 `paidCarats` per pull, capped
   at one pull per active banner day (`differenceInDays(endDate, max(today, bannerStart))`)
   and by the paid balance — the discount stops the instant `paidCarats` can't cover another 50.
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
- **Free vs paid carats are tracked separately.** All income accrues to `freeCarats`; `paidCarats` only decreases (via pulls). They combine only for the displayed total. This split is required for discounted paid pulls (paid-only) and for the `full_price_paid_pulls` reserve behavior. A shortfall lands on `freeCarats` (goes negative) rather than paid.
- **Windows are half-open `(lastEndDate, endDate]`.** The start day is excluded so adjacent banner windows don't double-count their shared boundary day. Totals therefore don't depend on how many banners the timeline is split into — guarded by the "banner count invariance" tests.
- **The projection is anchored to a stable start-of-today.** Recomputes on the same calendar day are deterministic; there is no per-recompute time drift.
- **`carats_throughout` is front-loaded, not a flat rate.** More of an event's throughout-carat pool is earned early in its life than late — see `remainingShare` in `utils/incomeCalculationUtils.ts`.
- **The cutoff is `end_date`, not `start_date`.** A banner starting April 1 and ending April 14 captures income through April 14. The resources shown are what you'll have at the end of that banner's run.
- **Uma tickets only offset uma banner pulls; support tickets only offset support banner pulls.** There is no cross-ticket substitution.
- **Banners must be sorted by timeline start date** for the sequential window logic to produce correct results. This sort is enforced server-side.

---

## Adding a New Income Source

1. Add the income data to the `GET /calculator-data` response and to `BannerResourcesParams`.
2. Insert the accumulation step inside the per-banner loop (steps 2–9 above), in the correct position relative to the cutoff date check.
3. Update `backend/docs/income-calculation.md` with the game mechanic, amounts, and schedule.
4. Add the new param to the `useMemo` dependency array at the bottom of the hook.
