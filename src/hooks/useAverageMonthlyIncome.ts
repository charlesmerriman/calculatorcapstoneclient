/**
 * Calculates average monthly income over a fixed 5-month window starting today.
 * This is purely additive — pull costs are not deducted.
 */

import { useMemo } from "react"
import { addMonths, differenceInDays } from "date-fns"
import {
	DAILY_CARAT_PACK_PER_DAY,
	TRAINING_PASS_START_DATE,
	TRAINING_PASS_MONTHLY_REWARD,
	TRAINING_PASS_REWARD_DAY,
	MONTHLY_BASE_REWARD,
} from "../constants/gameConstants"
import {
	calculateDailyIncome,
	calculateMondaysBetween,
	calculateMonthlyOccurrences,
	calculateDayOfMonthOccurrences,
} from "../utils/incomeCalculationUtils"
import type {
	UserStats,
	ClubRank,
	TeamTrialsRank,
	ChampionsMeetingRank,
	LeagueOfHeroesRank,
	EventReward,
	ChampionsMeeting,
	LeagueOfHeroes,
} from "../types"

export interface AverageMonthlyIncome {
	carats: number
	umaTickets: number
	supportTickets: number
	ssrShards: number
	srShards: number
}

interface AverageMonthlyIncomeParams {
	userStatsData: UserStats | null
	clubRankData: ClubRank[]
	teamTrialsRankData: TeamTrialsRank[]
	championsMeetingRankData: ChampionsMeetingRank[]
	leagueOfHeroesRankData: LeagueOfHeroesRank[]
	eventRewardsData: EventReward[]
	championsMeetingData: ChampionsMeeting[]
	leagueOfHeroesData: LeagueOfHeroes[]
}

const WINDOW_MONTHS = 5

export function useAverageMonthlyIncome({
	userStatsData,
	clubRankData,
	teamTrialsRankData,
	championsMeetingRankData,
	leagueOfHeroesRankData,
	eventRewardsData,
	championsMeetingData,
	leagueOfHeroesData,
}: AverageMonthlyIncomeParams): AverageMonthlyIncome {
	return useMemo(() => {
		const zero = { carats: 0, umaTickets: 0, supportTickets: 0, ssrShards: 0, srShards: 0 }
		if (!userStatsData) return zero

		const start = new Date()
		const end = addMonths(start, WINDOW_MONTHS)
		const referenceDate = start

		const userChampionsMeetingRank = championsMeetingRankData.find(
			(r) => r.id === userStatsData.champions_meeting_rank
		)
		const userClubRank = clubRankData.find(
			(r) => r.id === userStatsData.club_rank
		)
		const userTeamTrialsRank = teamTrialsRankData.find(
			(r) => r.id === userStatsData.team_trials_rank
		)
		const userLeagueOfHeroesRank = leagueOfHeroesRankData.find(
			(r) => r.id === userStatsData.league_of_heroes_rank
		)

		let carats = 0
		let umaTickets = 0
		let supportTickets = 0
		let ssrShards = 0
		let srShards = 0

		// Event rewards whose date falls strictly after start and on or before end.
		// Matches the same comparison used in useBannerResources.
		for (const ev of eventRewardsData) {
			const date = new Date(ev.date)
			if (date > start && date <= end) {
				carats += ev.carat_amount
				umaTickets += ev.uma_ticket_amount
				supportTickets += ev.support_ticket_amount
				ssrShards += ev.ssr_shard_amount
				srShards += ev.sr_shard_amount
			}
		}

		// Champions Meeting payouts
		for (const meet of championsMeetingData) {
			const date = new Date(meet.end_date)
			if (date > start && date <= end) {
				carats += userChampionsMeetingRank?.income_amount ?? 0
			}
		}

		// League of Heroes payouts
		for (const loh of leagueOfHeroesData) {
			const date = new Date(loh.end_date)
			if (date > start && date <= end) {
				carats += userLeagueOfHeroesRank?.income_amount ?? 0
			}
		}

		const days = differenceInDays(end, start)
		const mondays = calculateMondaysBetween(start, end)
		const months = calculateMonthlyOccurrences(start, end)

		carats += userStatsData.daily_carat ? DAILY_CARAT_PACK_PER_DAY * days : 0
		carats += (userClubRank?.income_amount ?? 0) * months
		carats += (userTeamTrialsRank?.income_amount ?? 0) * mondays
		carats += calculateDailyIncome(start, end, referenceDate)

		// Training Pass — only exists from August 15, 2027
		if (end > TRAINING_PASS_START_DATE) {
			const passStart = start > TRAINING_PASS_START_DATE
				? start
				: TRAINING_PASS_START_DATE

			if (userStatsData.training_pass) {
				carats += calculateDayOfMonthOccurrences(passStart, end, TRAINING_PASS_REWARD_DAY) * TRAINING_PASS_MONTHLY_REWARD
			} else {
				carats += calculateMonthlyOccurrences(passStart, end) * MONTHLY_BASE_REWARD
			}
		}

		return {
			carats: Math.round(carats / WINDOW_MONTHS),
			umaTickets: Math.round(umaTickets / WINDOW_MONTHS),
			supportTickets: Math.round(supportTickets / WINDOW_MONTHS),
			ssrShards: Math.round(ssrShards / WINDOW_MONTHS),
			srShards: Math.round(srShards / WINDOW_MONTHS),
		}
	}, [
		championsMeetingData,
		championsMeetingRankData,
		clubRankData,
		eventRewardsData,
		leagueOfHeroesData,
		leagueOfHeroesRankData,
		teamTrialsRankData,
		userStatsData,
	])
}
