/**
 * Custom hook that calculates available resources (carats, tickets)
 * for each planned banner based on the user's income sources.
 *
 * TYPESCRIPT CONCEPT: Custom Hooks Return Types
 * We define BannerResources as a named interface rather than using
 * an inline object type. This makes the hook's contract clear and
 * reusable — any component that receives these results gets autocomplete.
 */

import { useMemo } from "react"
import { differenceInDays } from "date-fns"
import {
	DAILY_CARAT_PACK_PER_DAY,
	PULL_COST_CARATS,
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
	UserPlannedBanner,
	EventReward,
	ChampionsMeeting,
	LeagueOfHeroes
} from "../types"

export interface BannerResources {
	carats: number
	umaTickets: number
	supportTickets: number
}

interface BannerResourcesParams {
	userStatsData: UserStats | null
	clubRankData: ClubRank[]
	teamTrialsRankData: TeamTrialsRank[]
	championsMeetingRankData: ChampionsMeetingRank[]
	leagueOfHeroesRankData: LeagueOfHeroesRank[]
	eventRewardsData: EventReward[]
	championsMeetingData: ChampionsMeeting[]
	leagueOfHeroesData: LeagueOfHeroes[]
	userPlannedBannerData: UserPlannedBanner[]
}


export function useBannerResources({
	userStatsData,
	clubRankData,
	teamTrialsRankData,
	championsMeetingRankData,
	leagueOfHeroesRankData,
	eventRewardsData,
	championsMeetingData,
	leagueOfHeroesData,
	userPlannedBannerData
}: BannerResourcesParams): BannerResources[] {
	return useMemo(() => {
		/**
		 * TYPESCRIPT CONCEPT: Early Returns and Null Checks
		 *
		 * With strict mode, `userStatsData` is typed as `UserStats | null`.
		 * TypeScript won't let you access `.current_carat` on a possibly-null
		 * value. The early return handles this — after it, TypeScript knows
		 * userStatsData is non-null for the rest of the function.
		 * This is called "narrowing" — the type gets narrower as you rule out cases.
		 */
		if (!userStatsData) return []

		let carats = (userStatsData.current_carat || 0) + (userStatsData.current_paid_carat || 0)
		let umaTickets = userStatsData.uma_ticket || 0
		let supportTickets = userStatsData.support_ticket || 0

		const results: BannerResources[] = []
		const plannedBanners = [...userPlannedBannerData]
		let lastEndDate = new Date()

		// Pre-parse all event/meeting/LoH dates once so we don't reconstruct
		// Date objects on every iteration of the inner loops.
		const parsedEventRewards = eventRewardsData.map((ev) => ({
			...ev,
			parsedDate: new Date(ev.date),
		}))
		const parsedMeetings = championsMeetingData.map((m) => ({
			...m,
			parsedDate: new Date(m.end_date),
		}))
		const parsedLoH = leagueOfHeroesData.map((l) => ({
			...l,
			parsedDate: new Date(l.end_date),
		}))

		// Hoisted outside the loop — same "now" used for all banners.
		const referenceDate = new Date()

		const userChampionsMeetingRank = championsMeetingRankData.find(
			(rank) => rank.id === userStatsData.champions_meeting_rank
		)
		const userClubRank = clubRankData.find(
			(rank) => rank.id === userStatsData.club_rank
		)
		const userTeamTrialsRank = teamTrialsRankData.find(
			(rank) => rank.id === userStatsData.team_trials_rank
		)
		const userLeagueOfHeroesRank = leagueOfHeroesRankData.find(
			(rank) => rank.id === userStatsData.league_of_heroes_rank
		)

		for (const banner of plannedBanners) {
			const endDateStr =
				banner.banner_uma?.banner_timeline.end_date ??
				banner.banner_support?.banner_timeline.end_date
			if (!endDateStr) continue

			const endDate = new Date(endDateStr)

			for (const ev of parsedEventRewards) {
				if (ev.parsedDate > lastEndDate && ev.parsedDate <= endDate) {
					carats += ev.carat_amount
					umaTickets += ev.uma_ticket_amount
					supportTickets += ev.support_ticket_amount
				}
			}

			for (const meet of parsedMeetings) {
				if (meet.parsedDate > lastEndDate && meet.parsedDate <= endDate) {
					carats += userChampionsMeetingRank?.income_amount ?? 0
					umaTickets += userChampionsMeetingRank?.uma_ticket_amount ?? 0
					supportTickets += userChampionsMeetingRank?.support_ticket_amount ?? 0
				}
			}

			for (const loh of parsedLoH) {
				if (loh.parsedDate > lastEndDate && loh.parsedDate <= endDate) {
					carats += userLeagueOfHeroesRank?.income_amount ?? 0
					umaTickets += userLeagueOfHeroesRank?.uma_ticket_amount ?? 0
					supportTickets += userLeagueOfHeroesRank?.support_ticket_amount ?? 0
				}
			}

			const days = differenceInDays(endDate, lastEndDate)
			const mondays = calculateMondaysBetween(lastEndDate, endDate)
			const months = calculateMonthlyOccurrences(lastEndDate, endDate)

			carats += userStatsData.daily_carat ? DAILY_CARAT_PACK_PER_DAY * days : 0
			carats += (userClubRank?.income_amount ?? 0) * months
			carats += (userTeamTrialsRank?.income_amount ?? 0) * mondays
			carats += calculateDailyIncome(lastEndDate, endDate, referenceDate)

			// Training Pass (paid and free tiers) only exists from August 15, 2027.
			if (endDate > TRAINING_PASS_START_DATE) {
				// Clamp the start to the feature launch date so pre-launch months
				// don't generate any training pass income.
				const passStart = lastEndDate > TRAINING_PASS_START_DATE
					? lastEndDate
					: TRAINING_PASS_START_DATE

				if (userStatsData.training_pass) {
					carats += calculateDayOfMonthOccurrences(passStart, endDate, TRAINING_PASS_REWARD_DAY) * TRAINING_PASS_MONTHLY_REWARD
				} else {
					carats += calculateMonthlyOccurrences(passStart, endDate) * MONTHLY_BASE_REWARD
				}
			}

			results.push({ carats, umaTickets, supportTickets })

			const isUmaBanner = !!banner.banner_uma
			const freePulls =
				banner.banner_uma?.free_pulls ?? banner.banner_support?.free_pulls ?? 0
			let normalPullsNeeded = Math.max(0, banner.number_of_pulls - freePulls)

			if (isUmaBanner) {
				const use = Math.min(normalPullsNeeded, umaTickets)
				umaTickets -= use
				normalPullsNeeded -= use
				carats -= normalPullsNeeded * PULL_COST_CARATS
			} else {
				const use = Math.min(normalPullsNeeded, supportTickets)
				supportTickets -= use
				normalPullsNeeded -= use
				carats -= normalPullsNeeded * PULL_COST_CARATS
			}

			if (endDate > lastEndDate) {
				lastEndDate = endDate
			}
		}
		return results
	}, [
		championsMeetingData,
		championsMeetingRankData,
		clubRankData,
		eventRewardsData,
		leagueOfHeroesData,
		leagueOfHeroesRankData,
		teamTrialsRankData,
		userPlannedBannerData,
		userStatsData
	])
}