/**
 * Training scenario types.
 *
 * A scenario is a new, optional way to play the game (URA Finals, Aoharu,
 * Grand Live, Hashire! Mecha Umamusume). It grants no resources and touches
 * none of the projection maths — it exists to mark *when the game changed*, on
 * the Timeline and as a section band in the calculator's banner sheet.
 */

export interface Scenario {
	id: number
	name: string
	/**
	 * Frequently null, and that is the normal state rather than a fault:
	 * scenarios get entered before their art exists. Every consumer must render
	 * without it — see EventMarkerCard's placeholder branch.
	 */
	image: string | null
	/**
	 * The banner this scenario launched alongside, as a bare id. The planner
	 * pins the scenario's band directly above this banner's row, so the id is
	 * what's needed here rather than the nested banner (already held in full in
	 * `bannerTimelineData`).
	 */
	banner_timeline: number | null
	/**
	 * Borrowed from the launch banner, and null when there isn't one (or it has
	 * no resolved date) — an undated scenario simply doesn't render.
	 *
	 * NOTE there is deliberately no `end_date` here, and the API doesn't send
	 * one. A scenario is released and then stays available permanently: a newer
	 * scenario doesn't retire an older one, it just tends to get played more
	 * because it's more rewarding. There is no end for a field to hold.
	 */
	start_date: string | null
	is_predicted: boolean
	applied_offset_days: number
}
