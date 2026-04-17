/**
 * Banner-related type definitions.
 *
 * TYPESCRIPT CONCEPT: Interfaces vs Types
 * We use `interface` here because these represent object shapes coming from the API.
 * Interfaces are preferred for object shapes because they give better error messages
 * and can be extended later. Use `type` for unions, intersections, or aliases.
 */

/** Represents a time window during which banners are available for pulling */
export interface BannerTimeline {
	id: number
	name: string
	start_date: string
	end_date: string
	image: string
}

/** An individual uma (horse girl character) that can appear on a banner */
export interface Uma {
	id: number
	name: string
	image: string
	admin_comments: string
	recommendation: string
}

/** A support card that can appear on a banner */
export interface SupportCard {
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
	start_date: string
	end_date: string
	image: string
	banner_umas: BannerUma[]
	banner_supports: BannerSupport[]
}