/**
 * Calculates average monthly income over a fixed 5-month window starting today.
 * This is purely additive — pull costs are not deducted.
 */

import { useMemo } from "react"
import { addMonths, differenceInDays } from "date-fns"
import {
	DAILY_CARAT_PACK_PER_DAY,
	DAILY_CARAT_PACK_PAID_CARATS,
	DAILY_CARAT_PACK_CYCLE_DAYS,
	MISC_EARNINGS_PER_DAY,
	MISC_EARNINGS_DELAY_DAYS,
	FIFTY_DAY_LOGIN_PER_CYCLE,
	FIFTY_DAY_LOGIN_CYCLE_DAYS,
	VALENTINES_CARATS,
	VALENTINES_MONTH,
	VALENTINES_DAY,
	WHITE_DAY_CARATS,
	WHITE_DAY_MONTH,
	WHITE_DAY_DAY,
	MONTHLY_SHOP_UMA_TICKETS,
	MONTHLY_SHOP_SUPPORT_TICKETS,
} from "../constants/gameConstants"
import {
	calculateDailyIncome,
	calculateMondaysBetween,
	calculateMonthlyOccurrences,
	calculateIntervalOccurrences,
	calculateAnnualDateOccurrences,
	countDaysAfterDelay,
	sumRemainingThroughoutCarats,
	getTrainingPassIncome,
} from "../utils/incomeCalculationUtils"
import type {
	UserStats,
	ClubRank,
	TeamTrialsRank,
	ChampionsMeetingRank,
	LeagueOfHeroesRank,
	GameEvent,
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
	gameEventsData: GameEvent[]
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
	gameEventsData,
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

		// Game events whose start_date falls strictly after start and on or
		// before end. Matches the same comparison used in useBannerResources.
		for (const ge of gameEventsData) {
			const startDate = ge.start_date ? new Date(ge.start_date) : null
			if (startDate && startDate > start && startDate <= end) {
				carats += ge.carat_amount
				umaTickets += ge.uma_ticket_amount
				supportTickets += ge.support_ticket_amount
				ssrShards += ge.ssr_shard_amount
				srShards += ge.sr_shard_amount
			}
		}

		// `start` is today here, so the absolute filter total IS this window's
		// throughout income — no delta needed (unlike useBannerResources, which
		// carries one balance across several checkpoints).
		carats += sumRemainingThroughoutCarats(gameEventsData, start, end)

		// Champions Meeting payouts
		for (const meet of championsMeetingData) {
			const date = new Date(meet.end_date)
			if (date > start && date <= end) {
				carats += userChampionsMeetingRank?.income_amount ?? 0
				umaTickets += userChampionsMeetingRank?.uma_ticket_amount ?? 0
				supportTickets += userChampionsMeetingRank?.support_ticket_amount ?? 0
				ssrShards += userChampionsMeetingRank?.ssr_shard_amount ?? 0
				srShards += userChampionsMeetingRank?.sr_shard_amount ?? 0
			}
		}

		// League of Heroes payouts
		for (const loh of leagueOfHeroesData) {
			const date = new Date(loh.end_date)
			if (date > start && date <= end) {
				carats += userLeagueOfHeroesRank?.income_amount ?? 0
				umaTickets += userLeagueOfHeroesRank?.uma_ticket_amount ?? 0
				supportTickets += userLeagueOfHeroesRank?.support_ticket_amount ?? 0
				ssrShards += userLeagueOfHeroesRank?.ssr_shard_amount ?? 0
				srShards += userLeagueOfHeroesRank?.sr_shard_amount ?? 0
			}
		}

		const days = differenceInDays(end, start)
		const mondays = calculateMondaysBetween(start, end)
		const months = calculateMonthlyOccurrences(start, end)

		carats += userStatsData.daily_carat ? DAILY_CARAT_PACK_PER_DAY * days : 0
		// Plus the pack's 500 paid carats per 30-day repurchase cycle. This view
		// reports one combined carat figure, so free and paid income are summed
		// here — the free/paid split only matters to the per-banner projection,
		// where the two balances buy pulls at different prices.
		if (userStatsData.daily_carat) {
			carats +=
				DAILY_CARAT_PACK_PAID_CARATS *
				calculateIntervalOccurrences(start, end, start, DAILY_CARAT_PACK_CYCLE_DAYS)
		}
		carats += (userClubRank?.income_amount ?? 0) * months
		carats += (userTeamTrialsRank?.income_amount ?? 0) * mondays
		carats += calculateDailyIncome(start, end, referenceDate)

		// Misc earnings (toggle-gated): a daily drip that starts after a 30-day
		// ramp-in counted from the window start (= today), so the first 30 days
		// earn none of it and every day after earns 60. See useBannerResources.
		if (userStatsData.misc_earnings) {
			carats +=
				MISC_EARNINGS_PER_DAY *
				countDaysAfterDelay(start, end, start, MISC_EARNINGS_DELAY_DAYS)
		}

		// 50-day login campaign (universal): same rolling-cycle treatment,
		// anchored to the window start so the first payout lands on day 50.
		carats +=
			FIFTY_DAY_LOGIN_PER_CYCLE *
			calculateIntervalOccurrences(start, end, start, FIFTY_DAY_LOGIN_CYCLE_DAYS)

		// Valentine's Day and White Day gifts. Note these only contribute when
		// the fixed WINDOW_MONTHS window happens to span February 14 / March 14 —
		// the averaged figure therefore rises when the window covers them and is
		// absent otherwise, which is inherent to averaging a fixed forward window
		// over incomes that only occur once a year. The two dates are a month
		// apart, so a 5-month window usually picks up both or neither.
		carats +=
			VALENTINES_CARATS *
			calculateAnnualDateOccurrences(start, end, VALENTINES_MONTH, VALENTINES_DAY)
		carats +=
			WHITE_DAY_CARATS *
			calculateAnnualDateOccurrences(start, end, WHITE_DAY_MONTH, WHITE_DAY_DAY)

		// Monthly shop tickets: fixed uma/support bundle each month (no carat cost).
		if (userStatsData.monthly_shop_tickets) {
			umaTickets += MONTHLY_SHOP_UMA_TICKETS * months
			supportTickets += MONTHLY_SHOP_SUPPORT_TICKETS * months
		}

		// Training Pass — only exists from August 15, 2027. Same helper as
		// useBannerResources, so carats and tickets stay in step across both views.
		// Free and paid carats are summed here (as with the Daily Carat Pack
		// above) because this view reports one combined monthly figure.
		const trainingPass = getTrainingPassIncome(start, end, userStatsData.training_pass)
		carats += trainingPass.freeCarats + trainingPass.paidCarats
		umaTickets += trainingPass.umaTickets
		supportTickets += trainingPass.supportTickets

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
		gameEventsData,
		leagueOfHeroesData,
		leagueOfHeroesRankData,
		teamTrialsRankData,
		userStatsData,
	])
}
