import type React from "react"

export type BannerTimeline = {
	id: number
	name: string
	start_date: string
	end_date: string
	image: string
}

export type UserStats = {
	current_carat: number
	uma_ticket: number
	support_ticket: number
	daily_carat: boolean
	club_rank: number
	team_trials_rank: number
	champions_meeting_rank: number
}

export type ClubRank = {
	id: number
	name: string
	income_amount: number
}

export type TeamTrailsRank = {
	id: number
	name: string
	income_amount: number
}

export type ChampionsMeetingRank = {
	id: number
	name: string
	income_amount: number
}

export type UserPlannedBanner = | {
	id: number
	tempId?: never
	user: number
	number_of_pulls: number
	banner_support: BannerSupport
	banner_uma?: never
} | {
	id?: never
	tempId: number
	user?: never
	number_of_pulls: number
	banner_support?: BannerSupport | null
	banner_uma?: never 
} | {
	id?: never
	tempId: number
	user?: never
	number_of_pulls: number
	banner_support?: never
	banner_uma?: BannerUma | null
} | {
	id: number
	tempId?: never
	user: number
	number_of_pulls: number
	banner_support?: never
	banner_uma: BannerUma
}

export type BannerSupport = {
	id: number,
	banner_timeline: BannerTimeline,
	name: string,
	admin_comments: string
	support_cards: SupportCard[]
	free_pulls: number
}

export type BannerUma = {
	id: number,
	banner_timeline: BannerTimeline,
	name: string,
	admin_comments: string
	umas: Uma[]
	free_pulls: number
}

export type SupportCard = {
	id: number,
	name: string,
	image: string,
	admin_comments: string
}

export type Uma = {
	id: number,
	name: string,
	image: string,
	admin_comments: string
}

export type ChampionsMeeting = {
	id: number,
	name: string,
	cm_number: number,
	start_date: string,
	end_date: string,
	image: string,
	track: string,
	surface_type: string,
	distance: string,
	length: string,
	track_condition: string,
	season: string,
	weather: string,
	direction: string,
	speed_recommendation: string,
	stamina_recommendation: string,
	power_recommendation: string,
	guts_recommendation: string,
	wit_recommendation: string
}

export type EventRewards = {
	id: number,
	name: string,
	carat_amount: number,
	support_ticket_amount: number,
	uma_ticket_amount: number,
	date: string
}

export type CalculatorData = {
	user_stats_data: UserStats
	club_rank_data: ClubRank[]
	team_trials_rank_data: TeamTrailsRank[]
	champions_meeting_rank_data: ChampionsMeetingRank[]
	banner_uma_data: BannerUma[]
	banner_support_data: BannerSupport[]
	user_planned_banner_data: UserPlannedBanner[] | []
	event_rewards_data: EventRewards[]
	champions_meeting_data: ChampionsMeeting[]
}

export type CalculatorContextType = {
	userStatsData: UserStats | null
	clubRankData: ClubRank[] | []
	teamTrialsRankData: TeamTrailsRank[] | []
	championsMeetingRankData: ChampionsMeetingRank[] | []
	umaBannerData: BannerUma[] | []
	supportBannerData: BannerSupport[] | []
	eventRewardsData: EventRewards[] | []
	championsMeetingData: ChampionsMeeting[] | []
	userPlannedBannerData: UserPlannedBanner[] | []
	timerIsGoing: boolean
	isDropdown: boolean
	handleDropDownToggle: () => void
	saveNow: () => void
	setIsDropdown: React.Dispatch<React.SetStateAction<boolean>>
	setUserPlannedBannerData: React.Dispatch<React.SetStateAction<UserPlannedBanner[]>>
	setUserStatsData: React.Dispatch<React.SetStateAction<UserStats | null>>
}