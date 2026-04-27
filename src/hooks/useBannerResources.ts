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
import {
	differenceInDays,
	eachDayOfInterval,
	getDay
} from "date-fns"
import type {
	UserStats,
	ClubRank,
	TeamTrialsRank,
	ChampionsMeetingRank,
	UserPlannedBanner,
	EventReward,
	ChampionsMeeting
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
	eventRewardsData: EventReward[]
	championsMeetingData: ChampionsMeeting[]
	userPlannedBannerData: UserPlannedBanner[]
}

function calculateDailyIncome(
	start: Date,
	end: Date,
	referenceDate: Date
): number {
	let totalIncome = 0
	const allDays = eachDayOfInterval({ start, end })

	allDays.forEach((day) => {
		totalIncome += 75

		const daysSinceReference = differenceInDays(day, referenceDate)

		if (daysSinceReference === 0) {
			totalIncome += 25
		} else if (daysSinceReference % 7 === 3) {
			totalIncome += 25
		} else if (daysSinceReference % 7 === 5) {
			totalIncome += 25
		} else if (daysSinceReference % 7 === 7) {
			totalIncome += 75
		}
	})

	return totalIncome
}

function calculateMondaysBetween(start: Date, end: Date): number {
	const allDays = eachDayOfInterval({ start, end })
	return allDays.filter((day) => getDay(day) === 1).length
}

function calculateMonthlyOccurrences(start: Date, end: Date): number {
	let count = 0
	const cursor = new Date(start)
	cursor.setDate(1)
	cursor.setMonth(cursor.getMonth() + 1)
	cursor.setHours(0, 0, 0, 0)
	while (cursor <= end) {
		count++
		cursor.setMonth(cursor.getMonth() + 1)
	}
	return count
}

function calculateDayOfMonthOccurrences(
	start: Date,
	end: Date,
	dayOfMonth: number
): number {
	let count = 0
	const cursor = new Date(start)
	cursor.setDate(dayOfMonth)
	cursor.setHours(0, 0, 0, 0)
	if (cursor <= start) {
		cursor.setMonth(cursor.getMonth() + 1)
	}
	while (cursor <= end) {
		count++
		cursor.setMonth(cursor.getMonth() + 1)
	}
	return count
}

export function useBannerResources({
	userStatsData,
	clubRankData,
	teamTrialsRankData,
	championsMeetingRankData,
	eventRewardsData,
	championsMeetingData,
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

		for (const banner of plannedBanners) {
			const endDateStr =
				banner.banner_uma?.banner_timeline.end_date ??
				banner.banner_support?.banner_timeline.end_date
			if (!endDateStr) continue

			const endDate = new Date(endDateStr)

			const userChampionsMeetingRank = championsMeetingRankData.find(
				(rank) => rank.id === userStatsData.champions_meeting_rank
			)
			const userClubRank = clubRankData.find(
				(rank) => rank.id === userStatsData.club_rank
			)
			const userTeamTrialsRank = teamTrialsRankData.find(
				(rank) => rank.id === userStatsData.team_trials_rank
			)

			for (const ev of eventRewardsData) {
				const evDate = new Date(ev.date)
				if (evDate > lastEndDate && evDate <= endDate) {
					carats += ev.carat_amount
					umaTickets += ev.uma_ticket_amount
					supportTickets += ev.support_ticket_amount
				}
			}

			for (const meet of championsMeetingData) {
				const meetDate = new Date(meet.end_date)
				if (meetDate > lastEndDate && meetDate <= endDate) {
					carats += userChampionsMeetingRank?.income_amount ?? 0
				}
			}

			const days = differenceInDays(endDate, lastEndDate)
			const mondays = calculateMondaysBetween(lastEndDate, endDate)
			const months = calculateMonthlyOccurrences(lastEndDate, endDate)
			const referenceDate = new Date()

			carats += userStatsData.daily_carat ? 50 * days : 0
			carats += (userClubRank?.income_amount ?? 0) * months
			carats += (userTeamTrialsRank?.income_amount ?? 0) * mondays
			carats += calculateDailyIncome(lastEndDate, endDate, referenceDate)

			if (userStatsData.training_pass) {
				carats += calculateDayOfMonthOccurrences(lastEndDate, endDate, 24) * 2200
			} else {
				carats += months * 500
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
				carats -= normalPullsNeeded * 150
			} else {
				const use = Math.min(normalPullsNeeded, supportTickets)
				supportTickets -= use
				normalPullsNeeded -= use
				carats -= normalPullsNeeded * 150
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
		teamTrialsRankData,
		userPlannedBannerData,
		userStatsData
	])
}