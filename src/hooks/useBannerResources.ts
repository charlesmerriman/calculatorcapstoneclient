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
import { differenceInDays, max, startOfDay } from "date-fns"
import {
	DAILY_CARAT_PACK_PER_DAY,
	TRAINING_PASS_START_DATE,
	TRAINING_PASS_MONTHLY_REWARD,
	TRAINING_PASS_REWARD_DAY,
	MONTHLY_BASE_REWARD,
	MISC_EARNINGS_PER_MONTH,
	FIFTY_DAY_LOGIN_PER_MONTH,
	MONTHLY_SHOP_UMA_TICKETS,
	MONTHLY_SHOP_SUPPORT_TICKETS,
} from "../constants/gameConstants"
import {
	calculateDailyIncome,
	calculateMondaysBetween,
	calculateMonthlyOccurrences,
	calculateDayOfMonthOccurrences,
	getThroughoutCaratsInWindow,
} from "../utils/incomeCalculationUtils"
import { applyPullStrategy } from "../utils/bannerHelpers"
import type {
	UserStats,
	ClubRank,
	TeamTrialsRank,
	ChampionsMeetingRank,
	LeagueOfHeroesRank,
	UserPlannedBanner,
	GameEvent,
	ChampionsMeeting,
	LeagueOfHeroes
} from "../types"

export interface BannerResources {
	carats: number
	/**
	 * Max pulls this banner could support if all available resources were spent
	 * on it (accounts for the paid-carat pull strategy). Drives "Max Pulls".
	 */
	maxPossiblePulls: number
	umaTickets: number
	supportTickets: number
}

interface BannerResourcesParams {
	userStatsData: UserStats | null
	clubRankData: ClubRank[]
	teamTrialsRankData: TeamTrialsRank[]
	championsMeetingRankData: ChampionsMeetingRank[]
	leagueOfHeroesRankData: LeagueOfHeroesRank[]
	gameEventsData: GameEvent[]
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
	gameEventsData,
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

		// Free (earned) and paid (purchased) carats are tracked separately: all
		// income accrues to free carats, while paid carats are the only source
		// for discounted pulls and are spent last at full price. They only merge
		// for the display total (see the per-banner snapshot below).
		let freeCarats = userStatsData.current_carat || 0
		let paidCarats = userStatsData.current_paid_carat || 0
		let umaTickets = userStatsData.uma_ticket || 0
		let supportTickets = userStatsData.support_ticket || 0

		const results: BannerResources[] = []
		const plannedBanners = [...userPlannedBannerData]

		// Anchor the whole projection to the START of today (local midnight),
		// computed once. Using a live `new Date()` here meant every recompute
		// (add/remove a banner, edit a stat, autosave round-trip) grabbed a
		// slightly later instant, so any event's front-loaded `carats_throughout`
		// — the only fractional income source — had "melted" a few more seconds
		// and credited a hair less, drifting the estimates down by ~1/100th of a
		// carat each update. A stable start-of-day makes recomputes on the same
		// calendar day produce identical numbers.
		const today = startOfDay(new Date())
		let lastEndDate = today

		// Pre-parse all event/meeting/LoH dates once so we don't reconstruct
		// Date objects on every iteration of the inner loops.
		const parsedGameEvents = gameEventsData.map((ge) => ({
			...ge,
			parsedStart: ge.start_date ? new Date(ge.start_date) : null,
			parsedEnd: ge.end_date ? new Date(ge.end_date) : null,
		}))
		const parsedMeetings = championsMeetingData.map((m) => ({
			...m,
			parsedDate: new Date(m.end_date),
		}))
		const parsedLoH = leagueOfHeroesData.map((l) => ({
			...l,
			parsedDate: new Date(l.end_date),
		}))

		// Same stable anchor drives the weekly-bonus pattern for every banner.
		const referenceDate = today

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
			const timeline =
				banner.banner_uma?.banner_timeline ??
				banner.banner_support?.banner_timeline
			const endDateStr = timeline?.end_date
			if (!endDateStr) continue

			const endDate = new Date(endDateStr)

			for (const ge of parsedGameEvents) {
				if (ge.parsedStart && ge.parsedStart > lastEndDate && ge.parsedStart <= endDate) {
					freeCarats += ge.carat_amount
					umaTickets += ge.uma_ticket_amount
					supportTickets += ge.support_ticket_amount
				}
				freeCarats += getThroughoutCaratsInWindow(
					{ carats_throughout: ge.carats_throughout, start_date: ge.parsedStart, end_date: ge.parsedEnd },
					lastEndDate,
					endDate
				)
			}

			for (const meet of parsedMeetings) {
				if (meet.parsedDate > lastEndDate && meet.parsedDate <= endDate) {
					freeCarats += userChampionsMeetingRank?.income_amount ?? 0
					umaTickets += userChampionsMeetingRank?.uma_ticket_amount ?? 0
					supportTickets += userChampionsMeetingRank?.support_ticket_amount ?? 0
				}
			}

			for (const loh of parsedLoH) {
				if (loh.parsedDate > lastEndDate && loh.parsedDate <= endDate) {
					freeCarats += userLeagueOfHeroesRank?.income_amount ?? 0
					umaTickets += userLeagueOfHeroesRank?.uma_ticket_amount ?? 0
					supportTickets += userLeagueOfHeroesRank?.support_ticket_amount ?? 0
				}
			}

			const days = differenceInDays(endDate, lastEndDate)
			const mondays = calculateMondaysBetween(lastEndDate, endDate)
			const months = calculateMonthlyOccurrences(lastEndDate, endDate)

			freeCarats += userStatsData.daily_carat ? DAILY_CARAT_PACK_PER_DAY * days : 0
			freeCarats += (userClubRank?.income_amount ?? 0) * months
			freeCarats += (userTeamTrialsRank?.income_amount ?? 0) * mondays
			freeCarats += calculateDailyIncome(lastEndDate, endDate, referenceDate)

			// Misc earnings (gifts, team trials, careers) is a flat monthly
			// approximation gated behind the user's toggle. The 50-day login
			// bonus is universal (no toggle). Both credit on month boundaries,
			// the same as Club Rank above.
			if (userStatsData.misc_earnings) {
				freeCarats += MISC_EARNINGS_PER_MONTH * months
			}
			freeCarats += FIFTY_DAY_LOGIN_PER_MONTH * months

			// Monthly shop tickets: a fixed uma/support ticket bundle buyable
			// each month (with an untracked currency), so no carat cost.
			if (userStatsData.monthly_shop_tickets) {
				umaTickets += MONTHLY_SHOP_UMA_TICKETS * months
				supportTickets += MONTHLY_SHOP_SUPPORT_TICKETS * months
			}

			// Training Pass (paid and free tiers) only exists from August 15, 2027.
			if (endDate > TRAINING_PASS_START_DATE) {
				// Clamp the start to the feature launch date so pre-launch months
				// don't generate any training pass income.
				const passStart = lastEndDate > TRAINING_PASS_START_DATE
					? lastEndDate
					: TRAINING_PASS_START_DATE

				if (userStatsData.training_pass) {
					freeCarats += calculateDayOfMonthOccurrences(passStart, endDate, TRAINING_PASS_REWARD_DAY) * TRAINING_PASS_MONTHLY_REWARD
				} else {
					freeCarats += calculateMonthlyOccurrences(passStart, endDate) * MONTHLY_BASE_REWARD
				}
			}

			// Discounted pulls are a once-per-day feature, so the cap is the
			// number of days this banner is still active (from today onward).
			// This uses the banner's OWN window, not the income-tiling window.
			const bannerStart = timeline?.start_date ? new Date(timeline.start_date) : today
			const discountDays = Math.max(0, differenceInDays(endDate, max([today, bannerStart])))

			const isUmaBanner = !!banner.banner_uma
			const freePulls =
				banner.banner_uma?.free_pulls ?? banner.banner_support?.free_pulls ?? 0

			// Snapshot the balance available *before* spending on this banner
			// (total carats for display, plus the strategy-aware max pulls),
			// then spend the planned pulls and carry the leftovers forward.
			const strategy = applyPullStrategy({
				isUmaBanner,
				plannedPulls: banner.number_of_pulls,
				freePulls,
				umaTickets,
				supportTickets,
				freeCarats,
				paidCarats,
				discountDays,
				discountedPaidPulls: userStatsData.discounted_paid_pulls,
				fullPricePaidPulls: userStatsData.full_price_paid_pulls,
			})

			results.push({
				carats: freeCarats + paidCarats,
				maxPossiblePulls: strategy.maxPossiblePulls,
				umaTickets,
				supportTickets,
			})

			freeCarats = strategy.freeCarats
			paidCarats = strategy.paidCarats
			umaTickets = strategy.umaTickets
			supportTickets = strategy.supportTickets

			if (endDate > lastEndDate) {
				lastEndDate = endDate
			}
		}
		return results
	}, [
		championsMeetingData,
		championsMeetingRankData,
		clubRankData,
		gameEventsData,
		leagueOfHeroesData,
		leagueOfHeroesRankData,
		teamTrialsRankData,
		userPlannedBannerData,
		userStatsData
	])
}