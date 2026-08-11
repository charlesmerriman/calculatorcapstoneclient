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
	MONTHLY_SHOP_TICKET_DAY,
} from "../constants/gameConstants"
import {
	calculateDailyIncome,
	calculateMondaysBetween,
	calculateMonthlyOccurrences,
	calculateDayOfMonthOccurrences,
	calculateIntervalOccurrences,
	calculateAnnualDateOccurrences,
	countDaysAfterDelay,
	sumRemainingThroughoutCarats,
	getTrainingPassIncome,
} from "../utils/incomeCalculationUtils"
import {
	cumulativeClubRankCarats,
	cumulativeDailyCarats,
	cumulativeDailyCaratPack,
	cumulativeLoginAndGiftCarats,
	cumulativeMiscEarningsCarats,
	cumulativeMonthlyShopTickets,
	cumulativeTeamTrialsCarats,
	cumulativeTrainingPassIncome,
} from "../utils/cumulativeIncome"
import {
	countRaceEvents,
	cumulativeEventRewards,
	cumulativeThroughoutCarats,
	parseLedger,
} from "../utils/incomeLedger"
import { startOfUtcDay } from "../utils/utcDates"
import type { CalculationConstants } from "../types/constants"
import type {
	UserStats,
	IncomeLedgerRow,
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

interface AverageMonthlyIncomeV2Params {
	userStatsData: UserStats | null
	clubRankData: ClubRank[]
	teamTrialsRankData: TeamTrialsRank[]
	championsMeetingRankData: ChampionsMeetingRank[]
	leagueOfHeroesRankData: LeagueOfHeroesRank[]
	incomeLedger: IncomeLedgerRow[]
	constants: CalculationConstants
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

		// Monthly shop tickets: fixed uma/support bundle stocked on the 2nd of each
		// month (no carat cost) — its own day-of-month count, not `months`.
		if (userStatsData.monthly_shop_tickets) {
			const shopMonths = calculateDayOfMonthOccurrences(
				start,
				end,
				MONTHLY_SHOP_TICKET_DAY
			)
			umaTickets += MONTHLY_SHOP_UMA_TICKETS * shopMonths
			supportTickets += MONTHLY_SHOP_SUPPORT_TICKETS * shopMonths
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

// ── Ledger-engine version ────────────────────────────────────────────────────

/**
 * The same figure, computed by the ledger engine.
 *
 * Kept in this file rather than its own so the two views of the same
 * calculation sit next to each other. They MUST agree: this drives the "Income
 * & Resources" tiles while useBannerResources drives the rows below them, and a
 * user comparing the two immediately sees any disagreement. Deleting the
 * function above is a single edit once the legacy engine goes.
 *
 * Note how much smaller it is. Every income source here is a cumulative total
 * from today to one fixed end date, which is exactly what the per-banner engine
 * asks for at each banner — so this is now one call to the same primitives
 * rather than a parallel re-implementation of every income rule. That
 * duplication was the reason the two hooks could silently drift, and the reason
 * a maintenance rule existed telling you to mirror every new income source into
 * both.
 *
 * Campaign purchases stay excluded, deliberately: they are one-off, and
 * averaging them across five months would report a recurring income nobody
 * earns.
 */
export function useAverageMonthlyIncomeV2({
	userStatsData,
	clubRankData,
	teamTrialsRankData,
	championsMeetingRankData,
	leagueOfHeroesRankData,
	incomeLedger,
	constants,
}: AverageMonthlyIncomeV2Params): AverageMonthlyIncome {
	return useMemo(() => {
		const zero = { carats: 0, umaTickets: 0, supportTickets: 0, ssrShards: 0, srShards: 0 }
		if (!userStatsData) return zero

		const now = new Date()
		const today = startOfUtcDay(now)
		// Date.UTC rolls a month overflow forward, so this is the same calendar
		// day five months out without needing a clamp.
		const end = new Date(
			Date.UTC(
				today.getUTCFullYear(),
				today.getUTCMonth() + WINDOW_MONTHS,
				today.getUTCDate()
			)
		)

		const ledger = parseLedger(incomeLedger)
		const clubRank = clubRankData.find((r) => r.id === userStatsData.club_rank)
		const teamTrialsRank = teamTrialsRankData.find(
			(r) => r.id === userStatsData.team_trials_rank
		)
		const cmRank = championsMeetingRankData.find(
			(r) => r.id === userStatsData.champions_meeting_rank
		)
		const lohRank = leagueOfHeroesRankData.find(
			(r) => r.id === userStatsData.league_of_heroes_rank
		)

		const events = cumulativeEventRewards(ledger, now, end)
		const cmCount = countRaceEvents(ledger, "champions_meeting", today, end)
		const lohCount = countRaceEvents(ledger, "league_of_heroes", today, end)
		const pack = userStatsData.daily_carat
			? cumulativeDailyCaratPack(today, end, constants)
			: { freeCarats: 0, paidCarats: 0 }
		const pass = cumulativeTrainingPassIncome(
			today, end, userStatsData.training_pass, constants
		)
		const shop = userStatsData.monthly_shop_tickets
			? cumulativeMonthlyShopTickets(today, end, constants)
			: { umaTickets: 0, supportTickets: 0 }

		// One combined carat figure here, unlike the per-banner projection: the
		// free/paid split only matters where the two balances buy pulls at
		// different prices.
		const carats =
			events.carats +
			cumulativeThroughoutCarats(ledger, now, end, constants) +
			cmCount * (cmRank?.income_amount ?? 0) +
			lohCount * (lohRank?.income_amount ?? 0) +
			cumulativeDailyCarats(today, end, constants) +
			cumulativeTeamTrialsCarats(today, end, teamTrialsRank?.income_amount ?? 0) +
			cumulativeClubRankCarats(today, end, clubRank?.income_amount ?? 0) +
			cumulativeLoginAndGiftCarats(today, end, constants) +
			(userStatsData.misc_earnings
				? cumulativeMiscEarningsCarats(today, end, constants)
				: 0) +
			pack.freeCarats + pack.paidCarats +
			pass.freeCarats + pass.paidCarats

		const umaTickets =
			events.umaTickets +
			cmCount * (cmRank?.uma_ticket_amount ?? 0) +
			lohCount * (lohRank?.uma_ticket_amount ?? 0) +
			shop.umaTickets + pass.umaTickets
		const supportTickets =
			events.supportTickets +
			cmCount * (cmRank?.support_ticket_amount ?? 0) +
			lohCount * (lohRank?.support_ticket_amount ?? 0) +
			shop.supportTickets + pass.supportTickets

		const ssrShards =
			events.ssrShards +
			cmCount * (cmRank?.ssr_shard_amount ?? 0) +
			lohCount * (lohRank?.ssr_shard_amount ?? 0)
		const srShards =
			events.srShards +
			cmCount * (cmRank?.sr_shard_amount ?? 0) +
			lohCount * (lohRank?.sr_shard_amount ?? 0)

		return {
			carats: Math.round(carats / WINDOW_MONTHS),
			umaTickets: Math.round(umaTickets / WINDOW_MONTHS),
			supportTickets: Math.round(supportTickets / WINDOW_MONTHS),
			ssrShards: Math.round(ssrShards / WINDOW_MONTHS),
			srShards: Math.round(srShards / WINDOW_MONTHS),
		}
	}, [
		userStatsData,
		clubRankData,
		teamTrialsRankData,
		championsMeetingRankData,
		leagueOfHeroesRankData,
		incomeLedger,
		constants,
	])
}
