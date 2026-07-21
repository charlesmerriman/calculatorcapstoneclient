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

/**
 * Share of a GameEvent's carats_throughout earned within [windowStart, windowEnd],
 * prorated by real elapsed time (not calendar days) across the event's own
 * start_date..end_date span. Milliseconds avoid an off-by-one from end_date
 * not being midnight-aligned (it's the linked banner's resolved end + a flat
 * 4-day buffer), and sidestep open/closed boundary ambiguity entirely — a
 * point-in-time boundary has zero width, so this composes correctly across a
 * chain of contiguous banner windows.
 *
 * For an event already in progress "now" (windowStart clipped to today),
 * this naturally excludes the already-elapsed share — carats_throughout is
 * divided by the event's FULL duration, not a renormalized remaining
 * duration, so already-elapsed carats are treated as already banked/spent
 * rather than redistributed onto what's left.
 */
export function getThroughoutCaratsInWindow(
	event: { carats_throughout: number; start_date: string | Date | null; end_date: string | Date | null },
	windowStart: Date,
	windowEnd: Date
): number {
	if (!event.carats_throughout || !event.start_date || !event.end_date) return 0

	const eventStart = event.start_date instanceof Date ? event.start_date : new Date(event.start_date)
	const eventEnd = event.end_date instanceof Date ? event.end_date : new Date(event.end_date)
	const totalMs = eventEnd.getTime() - eventStart.getTime()
	if (totalMs <= 0) return 0

	const overlapMs = Math.max(
		0,
		Math.min(eventEnd.getTime(), windowEnd.getTime()) - Math.max(eventStart.getTime(), windowStart.getTime())
	)
	return (overlapMs / totalMs) * event.carats_throughout
}
