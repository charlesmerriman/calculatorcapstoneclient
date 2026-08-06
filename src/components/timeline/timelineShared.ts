/**
 * Logic the timeline's banner card and race card both need.
 *
 * Split out of Timeline.tsx when the Champions Meeting card was generalised into
 * RaceEventCard — leaving it in Timeline.tsx would have made the card module
 * import from its own parent. Kept as a plain `.ts` module (no JSX, components
 * live in their own files) so React Fast Refresh isn't disabled here.
 */

import { differenceInCalendarDays } from "date-fns"
import { parseApiDate } from "../../utils/dateFormat"

// Countdown label for the badge in a card's header. Both dates are parsed
// through parseApiDate so date-only strings land on *local* midnight —
// `new Date("2026-08-10")` would parse as UTC and shift the day count by one
// for anyone west of GMT. Comparing calendar days (not elapsed hours) means an
// event starting later today reads "Starts today" rather than "in 0 days".
export function getCountdownLabel(startDate: string, endDate: string, today: Date): string {
	const start = parseApiDate(startDate)
	const end = parseApiDate(endDate)
	if (!start || !end) return ""

	const daysUntilStart = differenceInCalendarDays(start, today)
	if (daysUntilStart > 1) return `In ${daysUntilStart} Days`
	if (daysUntilStart === 1) return "Starts Tomorrow"
	if (daysUntilStart === 0) return "Starts Today"

	// Already started — the countdown flips to how much of it is left.
	const daysUntilEnd = differenceInCalendarDays(end, today)
	if (daysUntilEnd > 1) return `Ends in ${daysUntilEnd} Days`
	if (daysUntilEnd === 1) return "Ends Tomorrow"
	if (daysUntilEnd === 0) return "Ends Today"
	return "Ended"
}
