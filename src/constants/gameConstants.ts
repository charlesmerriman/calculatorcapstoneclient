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

// ── Monthly approximations ────────────────────────────────────────────────────

/**
 * Flat carat approximation for miscellaneous earnings (gifts, team trials,
 * career mode) — mirrors the source sheet's "Misc Earnings" figure. Gated
 * behind the user's `misc_earnings` toggle (on by default).
 *
 * Unlike the other flat incomes below, this is NOT credited on calendar-month
 * boundaries: it accrues over a rolling 30-day cycle anchored to today, so the
 * first payout lands MISC_EARNINGS_CYCLE_DAYS from now (nothing is earned
 * before then) and one more lands every cycle after that.
 */
export const MISC_EARNINGS_PER_CYCLE = 1800

/**
 * Length of one misc-earnings accrual cycle, in days. The user has to play a
 * full cycle before the first payout, which is why nothing is credited for the
 * first 30 days of the projection.
 */
export const MISC_EARNINGS_CYCLE_DAYS = 30

/**
 * Flat monthly carats from the game's recurring 50-day login campaign.
 * Universal income (like the base daily carats), so it is always applied —
 * there is no toggle. Credited on month boundaries. Approximate; tune here.
 */
export const FIFTY_DAY_LOGIN_PER_MONTH = 170

// ── Pull costs ────────────────────────────────────────────────────────────────

/** Carat cost of a single standard pull (after free pulls are consumed). */
export const PULL_COST_CARATS = 150

/**
 * Carat cost of a single "discounted paid pull" — a once-per-day option that
 * spends PAID carats only. Modeled as one discounted pull per active banner day
 * (see useBannerResources / applyPullStrategy).
 */
export const DISCOUNTED_PULL_COST_CARATS = 50

// ── Monthly shop tickets ──────────────────────────────────────────────────────

/**
 * Gacha tickets buyable from the in-game monthly shop with a currency not
 * tracked in this calculator. When the `monthly_shop_tickets` toggle is on,
 * these are credited each month at no carat cost.
 */
export const MONTHLY_SHOP_UMA_TICKETS = 3
export const MONTHLY_SHOP_SUPPORT_TICKETS = 4

// ── Training Pass monthly reward ──────────────────────────────────────────────

/**
 * The Training Pass feature (both paid and free tiers) does not exist until
 * this date. No training pass income should be calculated before it.
 */
export const TRAINING_PASS_START_DATE = new Date(2027, 7, 15) // August 15, 2027

/** Carats awarded on the 24th of each month when the Training Pass is active. */
export const TRAINING_PASS_MONTHLY_REWARD = 2200

/** Day of the month the Training Pass reward is delivered. */
export const TRAINING_PASS_REWARD_DAY = 24

/**
 * Monthly carat reward for the free tier of the Training Pass.
 * Awarded once per calendar month, but only after TRAINING_PASS_START_DATE.
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
