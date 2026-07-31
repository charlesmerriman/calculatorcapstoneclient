/**
 * Shared helpers for income calculation.
 * Used by both useBannerResources and useAverageMonthlyIncome.
 */

import { addDays, differenceInDays, eachDayOfInterval, getDay, subDays } from "date-fns"
import {
	DAILY_BASE_CARATS,
	WEEKDAY_BONUS_CARATS,
	WEEKEND_BONUS_CARATS,
	GAME_EVENT_END_DATE_BUFFER_DAYS,
	THROUGHOUT_END_OFFSET_DAYS,
	THROUGHOUT_FILTER_GRACE_DAYS,
	TRAINING_PASS_START_DATE,
	TRAINING_PASS_MONTHLY_FREE_CARATS,
	TRAINING_PASS_MONTHLY_PAID_CARATS,
	TRAINING_PASS_REWARD_DAY,
	TRAINING_PASS_FREE_UMA_TICKETS,
	TRAINING_PASS_FREE_SUPPORT_TICKETS,
	TRAINING_PASS_PAID_BONUS_UMA_TICKETS,
	TRAINING_PASS_PAID_BONUS_SUPPORT_TICKETS,
	MONTHLY_BASE_REWARD,
} from "../constants/gameConstants"

/**
 * Calculates total daily + weekly bonus carats earned in the half-open window
 * (start, end] — the start day is EXCLUDED, the end day is included.
 *
 * Why half-open: banner income is computed window-by-window where each window
 * runs from the previous banner's end to this banner's end. If both endpoints
 * were counted (as `eachDayOfInterval` does by default), the shared boundary
 * day between two adjacent banners would be counted twice — once as the last
 * day of the earlier window and once as the first day of the next. That makes
 * every banner you add inflate all downstream totals by ~a day's income.
 * Dropping the start day makes the windows tile perfectly: (a,b] ∪ (b,c] =
 * (a,c], with no overlap and no gap, so totals no longer depend on how many
 * banners the timeline is sliced into.
 *
 * referenceDate is the fixed "week anchor" — the same date used across all
 * calculations in a session so the weekly pattern stays consistent.
 */
export function calculateDailyIncome(
	start: Date,
	end: Date,
	referenceDate: Date
): number {
	// Empty (or backwards) window earns nothing. Guarding here also avoids
	// calling eachDayOfInterval with start > end, which throws.
	if (end <= start) return 0

	let totalIncome = 0
	// slice(1) drops the start day, turning the inclusive [start, end] that
	// eachDayOfInterval returns into the half-open (start, end] we want.
	const allDays = eachDayOfInterval({ start, end }).slice(1)

	allDays.forEach((day) => {
		totalIncome += DAILY_BASE_CARATS

		const daysSinceReference = differenceInDays(day, referenceDate)

		if (daysSinceReference % 7 === 0) {
			totalIncome += WEEKDAY_BONUS_CARATS
		} else if (daysSinceReference % 7 === 3) {
			totalIncome += WEEKDAY_BONUS_CARATS
		} else if (daysSinceReference % 7 === 5) {
			totalIncome += WEEKDAY_BONUS_CARATS
		} else if (daysSinceReference % 7 === 6) {
			totalIncome += WEEKEND_BONUS_CARATS
		}
	})

	return totalIncome
}

/**
 * Number of days in the half-open window (start, end] — the start day is
 * EXCLUDED, the end day is included. This is the day count for any income that
 * pays out once per calendar day (the Daily Carat Pack's drip, for example).
 *
 * Use this rather than date-fns' `differenceInDays`. The two disagree whenever
 * the window's endpoints are not at the same time of day, which for banner
 * windows is nearly always: the projection's cursor starts at local midnight
 * and banner timelines end at `21:59:59Z`-style instants. `differenceInDays`
 * measures ELAPSED 24-HOUR SPANS and truncates the remainder, so a window from
 * Aug 10 21:59 to Aug 14 17:11 measures 3 (3 d 19 h truncated) when the player
 * actually logs in on 4 days — Aug 11, 12, 13, 14.
 *
 * That truncation is per-window, so it does NOT tile: chaining (a,b] and (b,c]
 * loses up to a day at each internal boundary, which made every added banner
 * shave ~50 carats off all downstream estimates and every deleted banner hand
 * them back. Counting day boundaries instead makes the count additive —
 * (a,b] + (b,c] = (a,c] — which is the invariant the whole projection rests on.
 *
 * Also returns 0 rather than a negative for a backwards window, so an
 * out-of-order checkpoint can never subtract income.
 */
export function countDaysInWindow(start: Date, end: Date): number {
	if (end <= start) return 0
	// eachDayOfInterval is inclusive of both endpoints; dropping one turns the
	// count into the half-open (start, end] the windows are built from.
	return eachDayOfInterval({ start, end }).length - 1
}

/**
 * Count of Mondays in the half-open window (start, end] — the start day is
 * EXCLUDED, the end day is included. Used for Team Trials payouts. Half-open
 * for the same reason as calculateDailyIncome: a Monday landing exactly on a
 * banner boundary must not be paid out by both adjacent windows.
 */
export function calculateMondaysBetween(start: Date, end: Date): number {
	if (end <= start) return 0
	const allDays = eachDayOfInterval({ start, end }).slice(1)
	return allDays.filter((day) => getDay(day) === 1).length
}

/**
 * Count of 1st-of-month boundaries crossed strictly after start and up to end.
 * Each crossing represents one Club Rank monthly payout.
 */
export function calculateMonthlyOccurrences(start: Date, end: Date): number {
	let count = 0
	const cursor = new Date(start)
	cursor.setDate(1)
	cursor.setMonth(cursor.getMonth() + 1)
	cursor.setHours(0, 0, 0, 0)
	while (cursor <= end) {
		count++
		cursor.setMonth(cursor.getMonth() + 1)
	}
	return count
}

/**
 * Count of payouts from a fixed-interval schedule that land in the half-open
 * window (start, end]. Payouts occur at anchor + intervalDays,
 * anchor + 2×intervalDays, and so on — never on the anchor itself, since that
 * is "day 0" of the first cycle and nothing has accrued yet.
 *
 * The schedule is anchored to a date passed in from OUTSIDE the window (today,
 * in practice) rather than counted off `start`. That is what makes it tile
 * correctly across the chain of banner windows: the payout instants are
 * absolute, so slicing (a,c] into (a,b] ∪ (b,c] gives the same total — the same
 * property the 1st-of-month boundaries in calculateMonthlyOccurrences rely on.
 * Counting off each window's own start would instead restart the cycle at every
 * banner, inflating totals as more banners are planned.
 */
export function calculateIntervalOccurrences(
	start: Date,
	end: Date,
	anchor: Date,
	intervalDays: number
): number {
	if (end <= start || intervalDays <= 0) return 0

	let cursor = addDays(anchor, intervalDays)
	// Fast-forward past any payout that already happened before this window
	// opened (i.e. was credited by an earlier banner's window).
	while (cursor <= start) {
		cursor = addDays(cursor, intervalDays)
	}

	let count = 0
	while (cursor <= end) {
		count++
		cursor = addDays(cursor, intervalDays)
	}
	return count
}

/**
 * Number of days in the half-open window (start, end] that fall after a ramp-in
 * period of `delayDays` counted from `anchor` (today, in practice). This is the
 * day count for an income that drips DAILY but only once the user has played
 * for a while — misc earnings is currently the only one.
 *
 * The clamp is what makes it tile. `anchor + delayDays` is an ABSOLUTE instant:
 * it doesn't move with the window, so pushing each window's start forward to it
 * neither double-counts nor skips, and (a,b] + (b,c] = (a,c] holds wherever the
 * clamp point falls relative to a, b and c — the same property
 * calculateIntervalOccurrences gets from absolute payout instants. Counting the
 * ramp-in off each window's own start instead would restart it at every banner,
 * so a densely-planned timeline would earn almost nothing.
 *
 * Delegates the counting to countDaysInWindow, so it inherits calendar-day
 * counting rather than elapsed 24-hour spans — see that function for why the
 * distinction matters.
 */
export function countDaysAfterDelay(
	start: Date,
	end: Date,
	anchor: Date,
	delayDays: number
): number {
	const firstEarningDay = addDays(anchor, delayDays)
	// Whichever is later: the window's own start, or the day the drip begins.
	const clampedStart = start > firstEarningDay ? start : firstEarningDay
	return countDaysInWindow(clampedStart, end)
}

/**
 * Count of times a specific day-of-month occurs strictly after start and up to end.
 * Used for Training Pass rewards (delivered on the 24th each month).
 */
export function calculateDayOfMonthOccurrences(
	start: Date,
	end: Date,
	dayOfMonth: number
): number {
	let count = 0
	const cursor = new Date(start)
	cursor.setDate(dayOfMonth)
	cursor.setHours(0, 0, 0, 0)
	if (cursor <= start) {
		cursor.setMonth(cursor.getMonth() + 1)
	}
	while (cursor <= end) {
		count++
		cursor.setMonth(cursor.getMonth() + 1)
	}
	return count
}

/**
 * Count of times a specific calendar date (month + day, e.g. February 14) falls
 * in the half-open window (start, end] — the start day is EXCLUDED, the end day
 * is included. Used for once-a-year incomes like the Valentine's Day gift.
 *
 * Half-open for the same reason as every other counter here: a February 14 that
 * lands exactly on a banner boundary must be paid out by one window, not both.
 *
 * The occurrence instants are absolute calendar dates, so this tiles across a
 * chain of banner windows the same way calculateMonthlyOccurrences does —
 * slicing (a,c] into (a,b] ∪ (b,c] yields the same total.
 *
 * `month` is 0-indexed to match Date.getMonth() (1 = February).
 */
export function calculateAnnualDateOccurrences(
	start: Date,
	end: Date,
	month: number,
	dayOfMonth: number
): number {
	if (end <= start) return 0

	// new Date(y, m, d) is already local midnight, matching the startOfDay
	// anchor the projection uses.
	const cursor = new Date(start.getFullYear(), month, dayOfMonth)

	// This year's occurrence may already be behind us — or be the start day
	// itself, which the half-open window excludes — so walk forward until it
	// is strictly after start.
	while (cursor <= start) {
		cursor.setFullYear(cursor.getFullYear() + 1)
	}

	let count = 0
	while (cursor <= end) {
		count++
		cursor.setFullYear(cursor.getFullYear() + 1)
	}
	return count
}

export interface TrainingPassIncome {
	/** Ordinary earned carats — spent at full price like every other income. */
	freeCarats: number
	/** Purchased carats — the balance that can fund discounted pulls. */
	paidCarats: number
	umaTickets: number
	supportTickets: number
}

/**
 * Training Pass income earned in the half-open window (windowStart, windowEnd].
 *
 * The feature does not exist before TRAINING_PASS_START_DATE, so the window is
 * clamped to that launch date and a window ending before it earns nothing.
 *
 * The two reward kinds accrue on DIFFERENT clocks, which is the subtle part:
 *
 * - Carats are either/or. The paid pass pays its 2,200 on the 24th; without it
 *   the account gets MONTHLY_BASE_REWARD on the 1st (the free tier). They never
 *   stack, so this stays an if/else. The paid tier's 2,200 is also SPLIT across
 *   the two balances (1,850 free + 350 paid) because part of it is purchased
 *   currency; the free tier's 500 is entirely free carats.
 * - Tickets are base + bonus. Every account earns the free-tier tickets once
 *   the feature launches and an active paid pass adds its bonus on top. Both
 *   parts land on TRAINING_PASS_REWARD_DAY because the pass resets as a unit —
 *   so a free-tier account draws carats on the 1st but tickets on the 24th.
 *
 * Returns a value object instead of mutating caller counters so it stays pure
 * and testable; both useBannerResources and useAverageMonthlyIncome call it
 * with their own window, which is what keeps the two projections in step.
 */
export function getTrainingPassIncome(
	windowStart: Date,
	windowEnd: Date,
	hasPaidPass: boolean
): TrainingPassIncome {
	if (windowEnd <= TRAINING_PASS_START_DATE) {
		return { freeCarats: 0, paidCarats: 0, umaTickets: 0, supportTickets: 0 }
	}

	// Clamp the start to the launch date so pre-launch months earn nothing even
	// when the window straddles it.
	const passStart =
		windowStart > TRAINING_PASS_START_DATE ? windowStart : TRAINING_PASS_START_DATE

	const rewardDays = calculateDayOfMonthOccurrences(
		passStart,
		windowEnd,
		TRAINING_PASS_REWARD_DAY
	)

	const freeCarats = hasPaidPass
		? rewardDays * TRAINING_PASS_MONTHLY_FREE_CARATS
		: calculateMonthlyOccurrences(passStart, windowEnd) * MONTHLY_BASE_REWARD

	// Only the paid tier grants paid carats; the free tier's 500 is all free.
	const paidCarats = hasPaidPass ? rewardDays * TRAINING_PASS_MONTHLY_PAID_CARATS : 0

	const umaPerMonth =
		TRAINING_PASS_FREE_UMA_TICKETS +
		(hasPaidPass ? TRAINING_PASS_PAID_BONUS_UMA_TICKETS : 0)
	const supportPerMonth =
		TRAINING_PASS_FREE_SUPPORT_TICKETS +
		(hasPaidPass ? TRAINING_PASS_PAID_BONUS_SUPPORT_TICKETS : 0)

	return {
		freeCarats,
		paidCarats,
		umaTickets: rewardDays * umaPerMonth,
		supportTickets: rewardDays * supportPerMonth,
	}
}

const THROUGHOUT_DECAY_K = 2 // steepness of the early exponential leg
const THROUGHOUT_DECAY_LINEAR_SLOPE = 0.8 // slope of the linear fallback leg
const E_NEG_K = Math.exp(-THROUGHOUT_DECAY_K)
const MS_PER_DAY = 86_400_000

/** Minimal shape the throughout helpers need — a GameEvent, or anything like one. */
export interface ThroughoutEventLike {
	carats_throughout: number
	start_date: string | Date | null
	end_date: string | Date | null
}

const toDate = (value: string | Date): Date =>
	value instanceof Date ? value : new Date(value)

/**
 * Whole calendar days between two instants, measured in UTC — the equivalent of
 * the source sheet's `DATEDIF(from, to, "D")`.
 *
 * Deliberately NOT date-fns' differenceInDays, which measures elapsed 24-hour
 * spans. Banner windows are stored as `<start>T22:00:00Z` -> `<end>T21:59:59Z`,
 * so an elapsed-span measure reads a 9-day gap as 8 and shifts the whole decay
 * curve by a day. UTC rather than local for the same reason: the sheet works in
 * UTC throughout, and a local reading would make the projection depend on the
 * viewer's timezone.
 */
function utcDaysBetween(from: Date, to: Date): number {
	const midnight = (d: Date) =>
		Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
	return Math.round((midnight(to) - midnight(from)) / MS_PER_DAY)
}

/**
 * Rounds UP to the nearest 10, as the sheet's `CEILING(..., 10)` does.
 *
 * The toFixed pass is NOT cosmetic. The share is built from fractions like
 * 9/15, and `(1 - 9/15) * 0.8` evaluates to 0.32000000000000006 — enough to
 * push an exact 1,120 over the boundary and out as 1,130. The sheet's own cell
 * for that banner reads 1120, and matching it exactly is what confirmed the
 * rest of this model, so the noise has to be cleared before the ceiling.
 */
function ceilToTen(value: number): number {
	return Math.ceil(Number(value.toFixed(6)) / 10) * 10
}

/**
 * Recovers a banner's own end date from the event row the API returns, which
 * pads it by GAME_EVENT_END_DATE_BUFFER_DAYS.
 */
export function bannerEndFromEventEnd(eventEnd: Date): Date {
	return subDays(eventEnd, GAME_EVENT_END_DATE_BUFFER_DAYS)
}

/**
 * How many of an event's `carats_throughout` are still to be collected as of
 * `today` — a SINGLE figure per event, independent of any banner window.
 *
 * That independence is the whole point, and it is what this replaces. The old
 * model spread each pool proportionally across every banner window it
 * overlapped, which made a banner's estimate depend on how the user happened to
 * have sliced their plan. The source sheet instead evaluates the curve once,
 * from today, and credits the result whole to a single banner (see
 * sumRemainingThroughoutCarats) — so the same event contributes the same amount
 * no matter what else is planned.
 *
 * The curve blends a fast exponential early decay with a slower linear tail,
 * taking whichever leg has MORE left at a given moment. That makes the
 * exponential dominate just after the banner opens (front-loading the reward)
 * and the linear leg take over for the rest. It self-clamps outside the span:
 * before the banner starts both legs exceed 1 so MIN caps at 1 (nothing
 * collected yet, full pool remains), after it both go negative so MAX floors at
 * 0 (pool exhausted).
 *
 * Note the curve runs over the BANNER's window shortened by
 * THROUGHOUT_END_OFFSET_DAYS, not over the event's padded span — see those
 * constants. Getting this window wrong is silent: it just quietly over-credits.
 */
export function getRemainingThroughoutCarats(
	event: ThroughoutEventLike,
	today: Date
): number {
	if (!event.carats_throughout || !event.start_date || !event.end_date) return 0

	const bannerStart = toDate(event.start_date)
	const curveEnd = subDays(
		bannerEndFromEventEnd(toDate(event.end_date)),
		THROUGHOUT_END_OFFSET_DAYS
	)

	const span = utcDaysBetween(bannerStart, curveEnd)
	// A banner shorter than the trim has no curve to walk; treat it as spent
	// rather than dividing by zero or a negative.
	if (span <= 0) return 0

	const fraction = Math.min(Math.max(utcDaysBetween(bannerStart, today) / span, 0), 1)
	const exponential =
		(Math.exp(-THROUGHOUT_DECAY_K * fraction) - E_NEG_K) / (1 - E_NEG_K)
	const linear = 1 - fraction

	const share = Math.max(
		0,
		Math.min(1, exponential),
		Math.min(1, linear * THROUGHOUT_DECAY_LINEAR_SLOPE)
	)

	return ceilToTen(share * event.carats_throughout)
}

/**
 * Total throughout carats collectable by `checkpoint`, counting from today.
 *
 * This is an ABSOLUTE total, not a per-window one — which is the second half of
 * the departure described on getRemainingThroughoutCarats. The sheet re-runs
 * this filter from today for every banner rather than chaining windows, so
 * callers that carry a running balance should credit the DIFFERENCE between
 * consecutive checkpoints (see useBannerResources). The qualifying set only
 * grows as `checkpoint` advances, so that difference is never negative.
 *
 * An event qualifies when both hold:
 *   - its banner has not already finished (`bannerEnd >= today`) — carats from a
 *     closed banner are gone, not bankable;
 *   - its banner ends within THROUGHOUT_FILTER_GRACE_DAYS after the checkpoint.
 *
 * Note there is deliberately NO exclusion for banners already running: any
 * number of them can be in flight at once and all of them count, each
 * contributing only what it has left.
 */
export function sumRemainingThroughoutCarats(
	events: ThroughoutEventLike[],
	today: Date,
	checkpoint: Date
): number {
	let total = 0

	for (const event of events) {
		if (!event.carats_throughout || !event.end_date) continue

		const bannerEnd = bannerEndFromEventEnd(toDate(event.end_date))
		if (bannerEnd < today) continue
		if (subDays(bannerEnd, THROUGHOUT_FILTER_GRACE_DAYS) > checkpoint) continue

		total += getRemainingThroughoutCarats(event, today)
	}

	return total
}
