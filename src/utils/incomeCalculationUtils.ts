/**
 * Shared helpers for income calculation.
 * Used by both useBannerResources and useAverageMonthlyIncome.
 */

import { addDays, differenceInDays, eachDayOfInterval, getDay } from "date-fns"
import {
	DAILY_BASE_CARATS,
	WEEKDAY_BONUS_CARATS,
	WEEKEND_BONUS_CARATS,
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

/**
 * Fraction of an event's carats_throughout still uncredited at instant `t`
 * (1 = none earned yet, 0 = fully earned by end_date). Blends a fast
 * exponential early decay with a slower linear tail by taking whichever leg
 * has MORE left at a given moment -- that's what makes the exponential
 * dominate right after start_date (front-loading the reward) and the linear
 * leg take over for the rest, reaching exactly 0 at end_date. Self-clamps to
 * [0, 1] outside the event's span: before start_date both legs exceed 1 so
 * MIN(1, ...) caps it at 1; after end_date both legs go negative so
 * MAX(0, ...) floors it at 0.
 */
function remainingShare(t: Date, eventStart: Date, eventEnd: Date): number {
	const totalMs = eventEnd.getTime() - eventStart.getTime()
	if (totalMs <= 0) return 0

	const fraction = (t.getTime() - eventStart.getTime()) / totalMs
	const exponential = (Math.exp(-THROUGHOUT_DECAY_K * fraction) - E_NEG_K) / (1 - E_NEG_K)
	const linear = 1 - fraction

	return Math.max(0, Math.min(1, exponential), Math.min(1, linear * THROUGHOUT_DECAY_LINEAR_SLOPE))
}

/**
 * Share of a GameEvent's carats_throughout earned within [windowStart, windowEnd].
 * Front-loaded: more of the pool is credited earlier in the event's life than
 * later (see remainingShare above) -- not a flat per-millisecond rate. Computed
 * as the drop in "remaining share" between the window's two edges, which is
 * why this composes correctly across a chain of contiguous banner windows:
 * summing (remainingShare(a) - remainingShare(b)) + (remainingShare(b) -
 * remainingShare(c)) + ... telescopes to (remainingShare(a) - remainingShare(z))
 * no matter how many windows the event's span is chopped into. The outer
 * Math.max(0, ...) guards against a "backwards" window (windowEnd before
 * windowStart -- possible when an overlapping banner's own end date is
 * earlier than the running cutoff from a longer banner before it); without
 * it, a non-increasing remainingShare could produce a small negative credit.
 *
 * For an event already in progress "now" (windowStart clipped to today), this
 * still only credits the remaining share as of "now" -- whatever had already
 * decayed away before "now" is treated as already banked/spent, not
 * redistributed onto what's left.
 */
export function getThroughoutCaratsInWindow(
	event: { carats_throughout: number; start_date: string | Date | null; end_date: string | Date | null },
	windowStart: Date,
	windowEnd: Date
): number {
	if (!event.carats_throughout || !event.start_date || !event.end_date) return 0

	const eventStart = event.start_date instanceof Date ? event.start_date : new Date(event.start_date)
	const eventEnd = event.end_date instanceof Date ? event.end_date : new Date(event.end_date)

	const startShare = remainingShare(windowStart, eventStart, eventEnd)
	const endShare = remainingShare(windowEnd, eventStart, eventEnd)

	return Math.max(0, (startShare - endShare) * event.carats_throughout)
}
