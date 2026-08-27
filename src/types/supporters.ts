/**
 * Patreon supporters (the public thank-you list on the home page).
 *
 * Mirrors the GET /supporters response. Note what is NOT here: the backend
 * deliberately never sends `is_public`, `is_active` or `patron_since` — those
 * decide what appears, and none of them are the page's business. Supporters
 * who have not been cleared for publication are represented only by
 * `anonymousCount`, never by a row.
 */

export interface PatreonTier {
	id: number
	name: string
	/** Display rank, low first. Set by hand in the admin. */
	order: number
}

export interface PatreonSupporter {
	id: number
	display_name: string
	/** Null when the supporter has no tier assigned. */
	tier_name: string | null
	tier_order: number | null
}

export interface SupportersResponse {
	tiers: PatreonTier[]
	supporters: PatreonSupporter[]
	/** Active supporters who have not consented to being named. */
	anonymous_count: number
}
