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
