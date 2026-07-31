/**
 * Game constants for Uma Musume gacha resource calculations.
 *
 * All carat values are in-game carats (the main gacha currency).
 * These values come from the game's income schedule — see
 * backend/docs/income-calculation.md for the full breakdown.
 */

// ── Daily income ──────────────────────────────────────────────────────────────

/** Base carats awarded every day just for logging in. */
export const DAILY_BASE_CARATS = 75

/**
 * Extra carats awarded on certain weekday offsets from the reference date.
 * Applies on days where (daysSinceReference % 7) is 0, 3, or 5.
 */
export const WEEKDAY_BONUS_CARATS = 25

/**
 * Additional bonus on the "weekend" offset day (daysSinceReference % 7 === 6).
 * Stacks with DAILY_BASE_CARATS for a total of 150 on that day.
 */
export const WEEKEND_BONUS_CARATS = 75

/** Daily carats from the paid Daily Carat Pack, awarded per day when active. */
export const DAILY_CARAT_PACK_PER_DAY = 50

/**
 * PAID carats granted by each Daily Carat Pack purchase, on top of the per-day
 * carats above. The two halves land in different balances: the daily drip is
 * ordinary (free) carats, while this lump is purchased currency and therefore
 * the only recurring source of paid carats — the balance that funds discounted
 * pulls (see applyPullStrategy).
 */
export const DAILY_CARAT_PACK_PAID_CARATS = 500

/**
 * Length of one Daily Carat Pack purchase cycle, in days. Like the 50-day login
 * bonus (and unlike the month-boundary incomes), this is a rolling cycle
 * anchored to today: the pack the user holds right now is assumed already
 * reflected in their current paid-carat balance, so the first *modeled* payout
 * is the repurchase 30 days out, then one every 30 days after.
 */
export const DAILY_CARAT_PACK_CYCLE_DAYS = 30

// ── Monthly approximations ────────────────────────────────────────────────────

/**
 * Flat carat approximation for miscellaneous earnings (gifts, team trials,
 * career mode) — mirrors the source sheet's "Misc Earnings" figure. Gated
 * behind the user's `misc_earnings` toggle (on by default).
 *
 * A DAILY DRIP, not a periodic lump: once the ramp-in below has elapsed, this
 * amount is credited every single day. 60/day is the same long-run rate as the
 * 1,800-per-30-days lump this replaced, and matches how the source sheet
 * models it. The drip is what stops a banner's estimate from jumping by 1,800
 * the moment its end date crosses a cycle boundary — a plan tuned one day
 * either side of a boundary used to read very differently for no real reason.
 */
export const MISC_EARNINGS_PER_DAY = 60

/**
 * Days of play before misc earnings start accruing at all, counted from today.
 * Days 1..30 of the projection earn nothing and the first 60 lands on day 31 —
 * the same "you have to play a full cycle first" assumption the lump model
 * made, kept so a short banner still can't collect misc income the user
 * hasn't plausibly earned.
 *
 * Anchored to today rather than to each banner's window, so the instant the
 * drip starts is absolute and the per-window day counts tile (see
 * countDaysAfterDelay).
 */
export const MISC_EARNINGS_DELAY_DAYS = 30

/**
 * Carats granted by each completion of the game's recurring 50-day login
 * campaign. Universal income (like the base daily carats), so it is always
 * applied — there is no toggle.
 *
 * Like the Daily Carat Pack (and UNLIKE the month-boundary incomes), this is a
 * rolling cycle anchored to today: the campaign the user is
 * partway through right now is assumed already reflected in the balance they
 * entered, so the first modeled payout is the one FIFTY_DAY_LOGIN_CYCLE_DAYS
 * out, then one every cycle after.
 */
export const FIFTY_DAY_LOGIN_PER_CYCLE = 150

/** Length of one 50-day login campaign, in days. */
export const FIFTY_DAY_LOGIN_CYCLE_DAYS = 50

// ── Annual events ─────────────────────────────────────────────────────────────

/**
 * Carats gifted on Valentine's Day, once per year. Universal income with no
 * toggle, credited in full on the day itself.
 *
 * Month is 0-indexed to match JavaScript's Date.getMonth(), which is what
 * calculateAnnualDateOccurrences compares against — 1 is February, not January.
 */
export const VALENTINES_CARATS = 500
export const VALENTINES_MONTH = 1
export const VALENTINES_DAY = 14

/**
 * Carats gifted on White Day (March 14) — the reciprocal gift the game pairs
 * with Valentine's a month later. Universal income with no toggle, same
 * treatment as Valentine's above.
 *
 * The 500 amount is derived from the source sheet rather than read off a
 * settings cell: the sheet buckets both gifts into its "50 Day Login Bonus"
 * column, which reads 150 over a 62-day window (one 50-day payout, no gift
 * dates in range) and 2,050 over a 366-day window (seven 50-day payouts = 1,050,
 * plus Valentine's 500 and White Day 500). Its changelog entry 4.44 confirms the
 * two gifts are modelled as a pair. If a primary source ever gives a different
 * figure, this is the one number to change.
 *
 * Month is 0-indexed like VALENTINES_MONTH above — 2 is March.
 */
export const WHITE_DAY_CARATS = 500
export const WHITE_DAY_MONTH = 2
export const WHITE_DAY_DAY = 14

// ── Pull costs ────────────────────────────────────────────────────────────────

/** Carat cost of a single standard pull (after free pulls are consumed). */
export const PULL_COST_CARATS = 150

/**
 * Carat cost of a single "discounted paid pull" — a once-per-day option that
 * spends PAID carats only. Modeled as one discounted pull per day of the
 * banner's window, counted from the banner's start regardless of how much of
 * the window has already elapsed (see useBannerResources / applyPullStrategy).
 */
export const DISCOUNTED_PULL_COST_CARATS = 50

// ── Monthly shop tickets ──────────────────────────────────────────────────────

/**
 * Gacha tickets buyable from the in-game monthly shop with a currency not
 * tracked in this calculator. When the `monthly_shop_tickets` toggle is on,
 * these are credited each month at no carat cost.
 */
export const MONTHLY_SHOP_UMA_TICKETS = 4
export const MONTHLY_SHOP_SUPPORT_TICKETS = 4

// ── Training Pass monthly reward ──────────────────────────────────────────────

/**
 * The Training Pass feature (both paid and free tiers) does not exist until
 * this date. No training pass income should be calculated before it.
 */
export const TRAINING_PASS_START_DATE = new Date(2027, 7, 15) // August 15, 2027

/**
 * The paid Training Pass's monthly carats, split across the two balances the
 * projection tracks. Like the Daily Carat Pack above, part of the reward is
 * purchased currency: 350 of the 2,200 arrive as PAID carats (the only kind
 * that can buy discounted pulls), the other 1,850 as ordinary free carats.
 */
export const TRAINING_PASS_MONTHLY_PAID_CARATS = 350
export const TRAINING_PASS_MONTHLY_FREE_CARATS = 1850

/**
 * Total carats awarded on the 24th of each month when the Training Pass is
 * active — the headline "+2,200/mo" figure. DERIVED from the two halves above
 * so a balance change to either one can never leave the displayed total
 * disagreeing with what the projection actually credits.
 */
export const TRAINING_PASS_MONTHLY_REWARD =
	TRAINING_PASS_MONTHLY_FREE_CARATS + TRAINING_PASS_MONTHLY_PAID_CARATS

/** Day of the month the Training Pass reward is delivered. */
export const TRAINING_PASS_REWARD_DAY = 24

/**
 * Monthly carat reward for the free tier of the Training Pass.
 * Awarded once per calendar month, but only after TRAINING_PASS_START_DATE.
 * Free carats only — the paid split above is a paid-tier perk.
 */
export const MONTHLY_BASE_REWARD = 500

/**
 * Gacha tickets from the Training Pass, delivered on TRAINING_PASS_REWARD_DAY.
 *
 * Unlike the carat reward (paid tier REPLACES the free tier's 500), the tickets
 * are additive: every account gets the FREE amount once the feature launches,
 * and an active paid pass adds the PAID_BONUS on top — 2 + 2 = 4 of each type
 * per month. Kept as separate free/bonus constants rather than one "paid total"
 * so a future balance change to either tier is a single-number edit.
 */
export const TRAINING_PASS_FREE_UMA_TICKETS = 2
export const TRAINING_PASS_FREE_SUPPORT_TICKETS = 2
export const TRAINING_PASS_PAID_BONUS_UMA_TICKETS = 2
export const TRAINING_PASS_PAID_BONUS_SUPPORT_TICKETS = 2
