import type React from "react"

export type BannerType = {
	id: number
	name: string
}

export type BannerTag = {
	id: number
	name: string
}

export type Banner = {
	id: number
	name: string
	banner_type: BannerType
	banner_tag: BannerTag
	start_date: string
	end_date: string
	image: string | null
	admin_comments: string | null
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

export type UserPlannedBanner = {
	id: number
	user: number
	banner: number
	number_of_pulls: number

}

export type CalculatorData = {
	user_stats_data: UserStats
	club_rank_data: ClubRank[]
	team_trials_rank_data: TeamTrailsRank[]
	champions_meeting_rank_data: ChampionsMeetingRank[]
	banner_data: Banner[]
	user_planned_banner_data: UserPlannedBanner[]
}

export type CalculatorContextType = {
	data: CalculatorData | null
	userStatsData: UserStats | null
	clubRankData: ClubRank[] | null
	teamTrialsRankData: TeamTrailsRank[] | null
	championsMeetingRankData: ChampionsMeetingRank[] | null
	umaBannerData: Banner[] | null
	supportBannerData: Banner[] | null
	userPlannedBannerData: UserPlannedBanner[] | null
	currentCarats: number
	setCurrentCarats: React.Dispatch<React.SetStateAction<number>>
}