/**
 * Game event types.
 *
 * TYPESCRIPT CONCEPT: Naming Conventions
 * Types/interfaces should be singular nouns describing ONE instance.
 * "EventReward" (not "EventRewards") because each object IS one reward.
 * Arrays of them get typed as EventReward[] at the point of use.
 * The original codebase had "EventRewards" as the type name — this is
 * a common beginner mistake that makes it confusing when you see:
 *   const rewards: EventRewards[]  // "rewards of type EventRewardses"??
 *
 * We keep the old name as a deprecated alias so nothing breaks immediately.
 */

export interface EventReward {
	id: number
	name: string
	carat_amount: number
	support_ticket_amount: number
	uma_ticket_amount: number
	sr_shard_amount: number
	sr_crystal_amount: number
	ssr_shard_amount: number
	ssr_crystal_amount: number
	date: string
}

/**
 * `start_date`/`end_date` are derived entirely from the linked BannerTimeline
 * (resolved global dates, confirmed when available otherwise predicted from
 * the JP schedule; `end_date` trails the banner's own end date by 4 days) —
 * `banner_timeline` is null for events with no linked banner (e.g. Champions
 * Meeting tie-ins), in which case dates are null too.
 */
export interface GameEvent {
	id: number
	name: string
	image: string | null
	start_date: string | null
	end_date: string | null
	is_predicted: boolean
	banner_timeline: number | null
	rewards: EventReward[]
}

/** @deprecated Use EventReward (singular) instead */
export type EventRewards = EventReward

/**
 * `start_date`/`end_date` are the RESOLVED global dates (confirmed when
 * available, otherwise predicted from the JP schedule by the backend);
 * `is_predicted` is true when they're an estimate. The raw jp/global fields are
 * exposed for reference (global dates are null until the meeting is confirmed).
 */
export interface ChampionsMeeting {
	id: number
	name: string
	cm_number: number
	start_date: string
	end_date: string
	is_predicted: boolean
	jp_start_date: string | null
	jp_end_date: string | null
	global_start_date: string | null
	global_end_date: string | null
	image: string
	track: string
	surface_type: string
	distance: string
	length: string
	track_condition: string
	season: string
	weather: string
	direction: string
	speed_recommendation: string
	stamina_recommendation: string
	power_recommendation: string
	guts_recommendation: string
	wit_recommendation: string
}

/**
 * `start_date`/`end_date` are the RESOLVED global dates (confirmed when
 * available, otherwise predicted from the JP schedule by the backend);
 * `is_predicted` is true when they're an estimate. The raw jp/global fields are
 * exposed for reference (global dates are null until the event is confirmed).
 */
export interface LeagueOfHeroes {
	id: number
	name: string
	start_date: string
	end_date: string
	is_predicted: boolean
	jp_start_date: string | null
	jp_end_date: string | null
	global_start_date: string | null
	global_end_date: string | null
	image: string | null
}