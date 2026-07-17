/**
 * Date formatting helpers for the changelog.
 *
 * Inputs are date-only ISO strings from the API (e.g. "2026-07-16"). We parse
 * them into a LOCAL midnight Date (splitting the parts manually) rather than
 * `new Date("2026-07-16")`, which parses as UTC midnight and can land on the
 * previous calendar day in negative-offset timezones — an easy off-by-one.
 */

/** Parse a "YYYY-MM-DD" string into a Date at local midnight. Returns null if unparseable. */
function parseLocalDate(dateStr: string): Date | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr)
	if (!match) return null
	const [, y, m, d] = match
	return new Date(Number(y), Number(m) - 1, Number(d))
}

/** Whole-day difference (target − today); negative = in the past. */
function daysFromToday(date: Date): number {
	const now = new Date()
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
	const msPerDay = 1000 * 60 * 60 * 24
	return Math.round((date.getTime() - today.getTime()) / msPerDay)
}

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })

/**
 * Human-friendly relative date, e.g. "today", "yesterday", "3 days ago",
 * "2 weeks ago", "5 months ago". Buckets by the largest sensible unit.
 * Falls back to an empty string if the input can't be parsed.
 */
export function formatRelativeDate(dateStr: string): string {
	const date = parseLocalDate(dateStr)
	if (!date) return ""

	const days = daysFromToday(date)
	const abs = Math.abs(days)

	if (abs === 0) return "today"
	if (abs < 7) return rtf.format(days, "day")
	if (abs < 30) return rtf.format(Math.round(days / 7), "week")
	if (abs < 365) return rtf.format(Math.round(days / 30), "month")
	return rtf.format(Math.round(days / 365), "year")
}

/** Full readable date for card headings, e.g. "Jul 16, 2026". */
export function formatFullDate(dateStr: string): string {
	const date = parseLocalDate(dateStr)
	if (!date) return dateStr
	return date.toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	})
}
