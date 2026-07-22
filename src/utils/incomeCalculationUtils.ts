/**
 * Shared helpers for income calculation.
 * Used by both useBannerResources and useAverageMonthlyIncome.
 */

import { differenceInDays, eachDayOfInterval, getDay } from "date-fns"
import { DAILY_BASE_CARATS, WEEKDAY_BONUS_CARATS, WEEKEND_BONUS_CARATS } from "../constants/gameConstants"

/**
 * Calculates total daily + weekly bonus carats earned in [start, end].
 * referenceDate is the fixed "week anchor" — the same date used across all
 * calculations in a session so the weekly pattern stays consistent.
 */
export function calculateDailyIncome(
	start: Date,
	end: Date,
	referenceDate: Date
): number {
	let totalIncome = 0
	const allDays = eachDayOfInterval({ start, end })

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

/** Count of Mondays in [start, end] inclusive — used for Team Trials payouts. */
export function calculateMondaysBetween(start: Date, end: Date): number {
	const allDays = eachDayOfInterval({ start, end })
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
