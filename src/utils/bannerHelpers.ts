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
 */
export function calculateMaxPossiblePulls({
	plannedBanner,
	caratsAvailable,
	umaTicketsAvailable,
	supportTicketsAvailable
}: MaxPullsParams): number | "Passed" {
	const currentDate = new Date()

	if (plannedBanner.banner_uma) {
		const endDate = new Date(
			plannedBanner.banner_uma.banner_timeline.end_date
		)
		if (endDate.getTime() < currentDate.getTime()) {
			return "Passed"
		}
		return (
			plannedBanner.banner_uma.free_pulls +
			umaTicketsAvailable +
			Math.floor(caratsAvailable / 150)
		)
	}

	if (plannedBanner.banner_support) {
		const endDate = new Date(
			plannedBanner.banner_support.banner_timeline.end_date
		)
		if (endDate.getTime() < currentDate.getTime()) {
			return 0
		}
		return (
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