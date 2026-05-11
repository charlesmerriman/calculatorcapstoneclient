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
carats         = current_carat + current_paid_carat
umaTickets     = uma_ticket
supportTickets = support_ticket
lastEndDate    = today
results        = []
```

The planned banners are already sorted by timeline start date by the server (the `GET /calculator-data` endpoint annotates and orders by timeline date).

---

### Per-Banner Loop

For each banner in the sorted list:

**1. Determine the cutoff date**

The cutoff is the banner's `end_date` (from its `banner_timeline`). Resources earned right up to when the banner closes are counted. If no end date exists the banner is skipped.

**2. Add event rewards**

For every `EventReward` whose `date` is strictly after `lastEndDate` and on or before `endDate`:
```
carats         += reward.carat_amount
umaTickets     += reward.uma_ticket_amount
supportTickets += reward.support_ticket_amount
```
SR/SSR shards and crystals are received but the projection does not currently track those balances.

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
mondays = count of Mondays in [lastEndDate, endDate]
months  = count of 1st-of-month boundaries crossed
```

**5. Add daily carat bonus** (if enabled)

```
carats += 50 * days
```

**6. Add Club Rank payout**

```
carats += ClubRank.income_amount * months
```

**7. Add Team Trials payout**

```
carats += TeamTrialsRank.income_amount * mondays
```

**8. Add base daily income**

Iterates every single day in the window and adds:
- 75 carats (base, every day)
- +25 bonus every day where `daysSinceReference % 7 === 0` (first day of each week)
- +25 bonus every day where `daysSinceReference % 7 === 3`
- +25 bonus every day where `daysSinceReference % 7 === 5`
- +75 bonus every day where `daysSinceReference % 7 === 6` (last day of each week)

**9. Add Training Pass or monthly base payout**

The Training Pass feature (both paid and free tiers) does not exist until **August 15, 2027**. No income is added for any window that ends before that date.

For windows that extend past August 15, 2027, the calculation is clamped so only the post-launch portion counts:

```
passStart = max(lastEndDate, August 15 2027)

if training_pass:
    carats += 2200 * (occurrences of the 24th of the month in [passStart, endDate])
else:
    carats += 500 * (month boundaries crossed in [passStart, endDate])
```

**10. Record the snapshot**

```
results.push({ carats, umaTickets, supportTickets })
```

This is the value the UI displays for this banner — resources available at banner end.

**11. Deduct pull cost**

```
freePulls         = banner.free_pulls
normalPulls       = max(0, number_of_pulls - freePulls)

if uma banner:
    ticketsUsed   = min(normalPulls, umaTickets)
    umaTickets   -= ticketsUsed
    normalPulls  -= ticketsUsed
    carats       -= normalPulls * 150
else:
    ticketsUsed      = min(normalPulls, supportTickets)
    supportTickets  -= ticketsUsed
    normalPulls     -= ticketsUsed
    carats          -= normalPulls * 150
```

Tickets are spent before carats. Carats can go negative if the user plans more pulls than they can afford — the UI is expected to surface this as a warning.

**12. Advance the window**

```
lastEndDate = endDate
```

The next banner's income window starts from here.

---

## Key Invariants

- **Income is cumulative across banners.** Resources carry over; the loop never resets `carats`, `umaTickets`, or `supportTickets` to zero between banners.
- **The cutoff is `end_date`, not `start_date`.** A banner starting April 1 and ending April 14 captures income through April 14. The resources shown are what you'll have at the end of that banner's run.
- **Uma tickets only offset uma banner pulls; support tickets only offset support banner pulls.** There is no cross-ticket substitution.
- **Banners must be sorted by timeline start date** for the sequential window logic to produce correct results. This sort is enforced server-side.

---

## Adding a New Income Source

1. Add the income data to the `GET /calculator-data` response and to `BannerResourcesParams`.
2. Insert the accumulation step inside the per-banner loop (steps 2–9 above), in the correct position relative to the cutoff date check.
3. Update `backend/docs/income-calculation.md` with the game mechanic, amounts, and schedule.
4. Add the new param to the `useMemo` dependency array at the bottom of the hook.
