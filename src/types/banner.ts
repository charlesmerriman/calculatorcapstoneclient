/**
 * Banner-related type definitions.
 *
 * TYPESCRIPT CONCEPT: Interfaces vs Types
 * We use `interface` here because these represent object shapes coming from the API.
 * Interfaces are preferred for object shapes because they give better error messages
 * and can be extended later. Use `type` for unions, intersections, or aliases.
 */

import type { AttachedAnniversaryEvent } from "./anniversary"

/** Represents a time window during which banners are available for pulling.
 *
 * `start_date`/`end_date` are the RESOLVED global dates: the confirmed global
 * dates when available, otherwise dates predicted from the JP schedule by the
 * backend. `is_predicted` is true when they're an estimate. The raw jp and
 * global date fields are exposed for reference (the global dates are null
 * until a banner is confirmed).
 */
export interface BannerTimeline {
	id: number
	name: string
	start_date: string
	end_date: string
	is_predicted: boolean
	jp_start_date: string | null
	jp_end_date: string | null
	global_start_date: string | null
	global_end_date: string | null
	// Manual correction applied on top of the prediction, for when global slips
	// its schedule. `schedule_offset_days` is this row's own value (set in the
	// Django admin); `applied_offset_days` is the running total — its own plus
	// every offset earlier in the calendar — already baked into start_date and
	// end_date above. Both are 0 on confirmed rows. Diagnostic only: the dates
	// are complete without them.
	schedule_offset_days: number
	applied_offset_days: number
	image: string
}

/**
 * The card's earliest JP banner appearance, which is what selector eligibility
 * is judged on: a selector may only take cards whose first_jp_date is on or
 * before its cutoff. Derived server-side, never stored.
 *
 * Null means the card has never been featured on a banner in our data — treat
 * that as UNKNOWN, not "ancient". Eligibility refuses null under a real cutoff.
 */
interface JpDated {
	first_jp_date: string | null
}

/** An individual uma (horse girl character) that can appear on a banner */
export interface Uma extends JpDated {
	id: number
	name: string
	image: string
	admin_comments: string
	recommendation: string
}

/** A support card that can appear on a banner */
export interface SupportCard extends JpDated {
	id: number
	name: string
	image: string
	admin_comments: string
	recommendation: string
}

/** An uma gacha banner — contains one or more featured umas */
export interface BannerUma {
	id: number
	banner_timeline: BannerTimeline
	name: string
	admin_comments: string
	umas: Uma[]
	free_pulls: number
}

/** A support card gacha banner — contains one or more featured support cards */
export interface BannerSupport {
	id: number
	banner_timeline: BannerTimeline
	name: string
	admin_comments: string
	support_cards: SupportCard[]
	free_pulls: number
}

/**
 * An enriched banner timeline used by the Timeline view.
 * Includes nested uma and support banner arrays so the timeline
 * can display what's available during each time window.
 */
export interface BannerTimelineForViewing {
	id: number
	name: string
	// Constant tag from the backend; see ChampionsMeeting in types/events.ts for
	// why the merged timeline array narrows on this rather than on shape.
	event_type: "banner_timeline"
	start_date: string
	end_date: string
	is_predicted: boolean
	jp_start_date: string | null
	jp_end_date: string | null
	global_start_date: string | null
	global_end_date: string | null
	// See BannerTimeline for what these two mean.
	schedule_offset_days: number
	applied_offset_days: number
	// Null when a banner has no art uploaded yet (common for far-future,
	// still-predicted banners); the DRF ImageField serializes empty as null.
	image: string | null
	banner_umas: BannerUma[]
	banner_supports: BannerSupport[]
	/**
	 * The campaign this banner is a part of, or null. A summary rather than the
	 * whole campaign — the full record (with its products) arrives separately in
	 * anniversary_event_data, and nesting it here would repeat the catalogue on
	 * every part.
	 */
	anniversary_event: AttachedAnniversaryEvent | null
}