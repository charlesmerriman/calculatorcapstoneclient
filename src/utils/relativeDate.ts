/**
 * Relative ("3 days ago") date formatting for the changelog.
 *
 * Parsing lives in `dateFormat.ts` alongside the absolute formatter, so both
 * agree on how a given API string maps to a calendar day. See `parseApiDate`
 * for why date-only strings can't just go through `new Date()`.
 */

import { parseApiDate } from "./dateFormat"

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
	const date = parseApiDate(dateStr)
	if (!date) return ""

	const days = daysFromToday(date)
	const abs = Math.abs(days)

	if (abs === 0) return "today"
	if (abs < 7) return rtf.format(days, "day")
	if (abs < 30) return rtf.format(Math.round(days / 7), "week")
	if (abs < 365) return rtf.format(Math.round(days / 30), "month")
	return rtf.format(Math.round(days / 365), "year")
}
