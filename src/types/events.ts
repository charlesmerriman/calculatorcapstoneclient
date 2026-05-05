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

export interface GameEvent {
	id: number
	name: string
	image: string
	start_date: string
	end_date: string
	rewards: EventReward[]
}

/** @deprecated Use EventReward (singular) instead */
export type EventRewards = EventReward

export interface ChampionsMeeting {
	id: number
	name: string
	cm_number: number
	start_date: string
	end_date: string
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

export interface LeagueOfHeroes {
	id: number
	name: string
	start_date: string
	end_date: string
	image: string | null
}