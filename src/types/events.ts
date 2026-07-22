/**
 * Game event types.
 *
 * Reward amounts used to live on a separate EventReward model (one-to-many
 * with GameEvent). In practice every event had at most one immediate reward
 * and one throughout-the-event reward, so the two were folded directly onto
 * GameEvent as fields — carat_amount is earned once the event's own resolved
 * start_date passes, carats_throughout is front-loaded across
 * start_date..end_date via a decay curve (see remainingShare in
 * utils/incomeCalculationUtils.ts) reaching 100% earned exactly at end_date,
 * independent of start_date. Only carats are ever distributed this way —
 * tickets/shards/crystals are always earned as a lump on start_date.
 */

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
	carat_amount: number
	carats_throughout: number
	support_ticket_amount: number
	uma_ticket_amount: number
	sr_shard_amount: number
	sr_crystal_amount: number
	ssr_shard_amount: number
	ssr_crystal_amount: number
}

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