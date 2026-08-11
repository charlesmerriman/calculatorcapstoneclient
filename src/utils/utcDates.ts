/**
 * UTC date arithmetic matching the source spreadsheet's functions.
 *
 * The projection works entirely in UTC. The sheet does too — its anchor cell is
 * labelled "Today's Date UTC" — and a local reading would make every estimate
 * depend on the viewer's timezone, which is exactly the bug that once handed
 * everyone east of Greenwich an extra day of undecayed carats.
 *
 * These are deliberately NOT date-fns equivalents. date-fns works in local time
 * and its `differenceInDays` measures elapsed 24-hour spans, which disagrees with
 * a calendar-day count whenever the endpoints sit at different times of day —
 * and banner windows almost never share one (`<start>T22:00:00Z` ->
 * `<end>T21:59:59Z`). Each function here names the sheet function it reproduces.
 */

const MS_PER_DAY = 86_400_000

/** Midnight UTC on the same calendar day — the sheet's implicit date value. */
export function startOfUtcDay(date: Date): Date {
	return new Date(
		Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
	)
}

export function addUtcDays(date: Date, days: number): Date {
	return new Date(date.getTime() + days * MS_PER_DAY)
}

/**
 * Whole calendar days between two instants, in UTC — `DATEDIF(from, to, "D")`.
 *
 * Quantises both ends to their UTC date first, so this counts day boundaries
 * rather than elapsed time. Can go negative; callers that must not subtract
 * income clamp at the call site.
 */
export function utcDaysBetween(from: Date, to: Date): number {
	return Math.round(
		(startOfUtcDay(to).getTime() - startOfUtcDay(from).getTime()) / MS_PER_DAY
	)
}

/**
 * COMPLETE months between two dates — `DATEDIF(from, to, "M")`.
 *
 * "Complete" is the part worth reading twice: Jan 31 -> Feb 28 is **0**, not 1,
 * because the day-of-month never came round again. That is why this can't be
 * written as a plain month-number subtraction, and why it is not the same thing
 * as the old `calculateMonthlyOccurrences`, which counted 1st-of-month crossings.
 */
export function utcMonthsBetween(from: Date, to: Date): number {
	const months =
		(to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
		(to.getUTCMonth() - from.getUTCMonth())
	// The final month hasn't completed if we haven't reached the same day-of-month.
	return to.getUTCDate() < from.getUTCDate() ? months - 1 : months
}

/** COMPLETE years between two dates — `DATEDIF(from, to, "Y")`. */
export function utcYearsBetween(from: Date, to: Date): number {
	const years = to.getUTCFullYear() - from.getUTCFullYear()
	const beforeAnniversary =
		to.getUTCMonth() < from.getUTCMonth() ||
		(to.getUTCMonth() === from.getUTCMonth() &&
			to.getUTCDate() < from.getUTCDate())
	return beforeAnniversary ? years - 1 : years
}

/** First day of `date`'s month, midnight UTC — the sheet's `EOMONTH(d, -1) + 1`. */
export function startOfUtcMonth(date: Date): Date {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

/**
 * The Monday of `date`'s week, midnight UTC — the sheet's
 * `d - WEEKDAY(d, 2) + 1`, where WEEKDAY(..., 2) is 1 on Monday through 7 on
 * Sunday. JS `getUTCDay()` is 0 on Sunday, so Sunday maps to 7 before shifting.
 */
export function startOfUtcWeek(date: Date): Date {
	const isoDay = date.getUTCDay() === 0 ? 7 : date.getUTCDay()
	return addUtcDays(startOfUtcDay(date), 1 - isoDay)
}

/**
 * Rounds UP to the nearest 10 — the sheet's `CEILING(value, 10)`.
 *
 * The toFixed pass is NOT cosmetic. Shares built from fractions like 9/15 give
 * `(1 - 9/15) * 0.8 === 0.32000000000000006`, enough to push an exact 1,120 over
 * the boundary and out as 1,130. The sheet's own cell for that banner reads
 * 1120, and matching it exactly is what confirmed the rest of the throughout
 * model — so the float noise has to be cleared before the ceiling.
 */
export function ceilToTen(value: number): number {
	return Math.ceil(Number(value.toFixed(6)) / 10) * 10
}
