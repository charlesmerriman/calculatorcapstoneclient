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

// ── Pull costs ────────────────────────────────────────────────────────────────

/** Carat cost of a single standard pull (after free pulls are consumed). */
export const PULL_COST_CARATS = 150

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
