import { startOfDay } from "date-fns"
import type { UserPlannedBanner } from "../types"

interface MaxPullsParams {
	plannedBanner: UserPlannedBanner
	caratsAvailable: number
	umaTicketsAvailable: number
	supportTicketsAvailable: number
}

/**
 * Calculates the maximum number of pulls a user can make on a banner,
 * accounting for free pulls, tickets, and carats.
 * Returns "Passed" if the banner has already ended.
 *
 * The "already ended" cutoff is the START of today (local midnight), matching
 * the projection's stable anchor in useBannerResources — not a live `new
 * Date()`. This keeps the two in sync: a banner ending *today* is still active
 * (the projection counts income through its end date), so it should show an
 * estimate rather than blanking to "Passed" partway through the day.
 *
 * The result is floored at 0: when earlier banners overspend, caratsAvailable
 * can be negative, and `Math.floor(negative / 150)` would otherwise drag the
 * whole total below zero and surface a nonsensical negative "Max Pulls".
 */
export function calculateMaxPossiblePulls({
	plannedBanner,
	caratsAvailable,
	umaTicketsAvailable,
	supportTicketsAvailable
}: MaxPullsParams): number | "Passed" {
	const today = startOfDay(new Date())

	if (plannedBanner.banner_uma) {
		const endDate = new Date(
			plannedBanner.banner_uma.banner_timeline.end_date
		)
		if (endDate.getTime() < today.getTime()) {
			return "Passed"
		}
		return Math.max(
			0,
			plannedBanner.banner_uma.free_pulls +
				umaTicketsAvailable +
				Math.floor(caratsAvailable / 150)
		)
	}

	if (plannedBanner.banner_support) {
		const endDate = new Date(
			plannedBanner.banner_support.banner_timeline.end_date
		)
		if (endDate.getTime() < today.getTime()) {
			return "Passed"
		}
		return Math.max(
			0,
			plannedBanner.banner_support.free_pulls +
				supportTicketsAvailable +
				Math.floor(caratsAvailable / 150)
		)
	}

	return 0
}

/**
 * Returns the free pull count for a planned banner, or empty string if no banner is set.
 *
 * TYPESCRIPT CONCEPT: Union Return Types
 *
 * This function returns `number | string` because it serves double duty:
 * a numeric value for calculations AND a display value ("" for empty state).
 * In a larger codebase, you might separate these concerns — one function
 * for the numeric value (returning number | null) and the component handles
 * the display formatting. But for a simple helper like this, the union is fine.
 */
export function getFreePulls(
	plannedBanner: UserPlannedBanner
): number | string {
	if (plannedBanner.banner_support) return plannedBanner.banner_support.free_pulls
	if (plannedBanner.banner_uma) return plannedBanner.banner_uma.free_pulls
	return ""
}