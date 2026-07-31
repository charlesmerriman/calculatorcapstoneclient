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
import { differenceInDays, startOfDay } from "date-fns"
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
	countDaysInWindow,
	countDaysAfterDelay,
	sumRemainingThroughoutCarats,
	getTrainingPassIncome,
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

		// Free (earned) and paid (purchased) carats are tracked separately:
		// essentially all income accrues to free carats, while paid carats are
		// the only source for discounted pulls and are spent last at full price.
		// The Daily Carat Pack's 500-carat repurchase lump is the one income
		// source that credits the paid side (see below). They only merge for the
		// display total (see the per-banner snapshot below).
		let freeCarats = userStatsData.current_carat || 0
		let paidCarats = userStatsData.current_paid_carat || 0
		let umaTickets = userStatsData.uma_ticket || 0
		let supportTickets = userStatsData.support_ticket || 0

		// One result slot per planned banner, pre-filled so the array always
		// lines up positionally with `userPlannedBannerData` — the consumer
		// reads `bannerResources[index]` for the row at the same index. A banner
		// with no resolvable timeline keeps its zeroed slot instead of shifting
		// every later row's result onto the wrong card.
		const results: BannerResources[] = userPlannedBannerData.map(() => ({
			carats: 0,
			maxPossiblePulls: 0,
			umaTickets: 0,
			supportTickets: 0,
		}))

		// Anchor the whole projection to the START of today (local midnight),
		// computed once. Using a live `new Date()` here meant every recompute
		// (add/remove a banner, edit a stat, autosave round-trip) grabbed a
		// slightly later instant, so any income measured in elapsed time had
		// "melted" a few more seconds, drifting the estimates on every update.
		// A stable start-of-day makes recomputes on the same calendar day
		// produce identical numbers.
		const today = startOfDay(new Date())

		// The throughout filter needs the current UTC DATE, which is not the same
		// thing. `today` above is LOCAL midnight, and for anyone east of Greenwich
		// that instant still falls on the PREVIOUS UTC day — which would hand them
		// an extra day's worth of undecayed carats for most of their day. The raw
		// instant carries the right UTC date, and passing it live is safe here
		// because the result is quantised to whole UTC days and then rounded to
		// the nearest 10, so it cannot drift between recomputes.
		const nowUtc = new Date()

		let lastEndDate = today
		// Throughout carats already credited by an earlier checkpoint. They are
		// tracked separately from `lastEndDate` because their filter is absolute
		// rather than window-tiled — see where this is used below.
		let creditedThroughout = 0

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

		// THE WALK ORDER — deliberately NOT the display order.
		//
		// This loop is a single pass down the calendar carrying one cursor
		// (`lastEndDate`). Each banner is a checkpoint keyed on its END date:
		// "advance the cursor to this banner's end, collecting income on the
		// way, and snapshot the balance there". A date cursor can only move
		// forward — that is what makes the windows tile — so the checkpoints
		// have to be visited in ascending end-date order.
		//
		// The display list is sorted by START date (see CaratCalculator), which
		// is what a reader expects but is NOT the same ordering: a banner can
		// open later and still close sooner than the row above it (a short
		// banner nested inside a long one — 14 such pairs exist in the current
		// schedule). Walking in display order gave those rows a backwards
		// window, so they collected nothing and reported the balance from the
		// PREVIOUS banner's later end date — overstating a real case by ~2,300
		// carats. Results are written back to each banner's display slot, so
		// nothing about the on-screen ordering changes.
		//
		// The sort is stable (guaranteed since ES2019), so banners sharing an
		// end date — every uma/support pair does — keep their display order and
		// therefore their existing spend priority.
		const walkOrder = userPlannedBannerData
			.map((banner, index) => {
				const timeline =
					banner.banner_uma?.banner_timeline ??
					banner.banner_support?.banner_timeline
				return {
					banner,
					index,
					timeline,
					endDate: timeline?.end_date ? new Date(timeline.end_date) : null,
				}
			})
			.filter((entry): entry is typeof entry & { endDate: Date } => entry.endDate !== null)
			.sort((a, b) => a.endDate.getTime() - b.endDate.getTime())

		for (const { banner, index, timeline, endDate } of walkOrder) {
			for (const ge of parsedGameEvents) {
				if (ge.parsedStart && ge.parsedStart > lastEndDate && ge.parsedStart <= endDate) {
					freeCarats += ge.carat_amount
					umaTickets += ge.uma_ticket_amount
					supportTickets += ge.support_ticket_amount
				}
			}

			// Throughout carats are the one income that does NOT tile window by
			// window: each event's contribution is fixed as of today, and the
			// filter that decides which banners can reach it runs absolutely from
			// today rather than from the previous checkpoint (see
			// sumRemainingThroughoutCarats). So take the running total at this
			// checkpoint and credit only what it added over the last one. The
			// qualifying set only grows as the cursor advances, so this delta is
			// never negative.
			const throughoutToDate = sumRemainingThroughoutCarats(
				parsedGameEvents,
				nowUtc,
				endDate
			)
			freeCarats += throughoutToDate - creditedThroughout
			creditedThroughout = throughoutToDate

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

			// Calendar days in (lastEndDate, endDate] — NOT elapsed 24-hour spans.
			// See countDaysInWindow: differenceInDays truncates each window's
			// fractional remainder, which doesn't tile across the banner chain.
			const days = countDaysInWindow(lastEndDate, endDate)
			const mondays = calculateMondaysBetween(lastEndDate, endDate)
			const months = calculateMonthlyOccurrences(lastEndDate, endDate)

			freeCarats += userStatsData.daily_carat ? DAILY_CARAT_PACK_PER_DAY * days : 0
			// The pack's second half: each repurchase grants a 500 PAID carat
			// lump. The daily drip above is ordinary earned currency, but this
			// is bought — so it goes to the paid balance, where it can fund
			// discounted pulls. It uses the same rolling-cycle machinery as the
			// 50-day login bonus (anchored to `today`, first payout on day 30),
			// so the payout instants are absolute and the banner windows still
			// tile.
			if (userStatsData.daily_carat) {
				paidCarats +=
					DAILY_CARAT_PACK_PAID_CARATS *
					calculateIntervalOccurrences(
						lastEndDate,
						endDate,
						today,
						DAILY_CARAT_PACK_CYCLE_DAYS
					)
			}
			freeCarats += (userClubRank?.income_amount ?? 0) * months
			freeCarats += (userTeamTrialsRank?.income_amount ?? 0) * mondays
			freeCarats += calculateDailyIncome(lastEndDate, endDate, referenceDate)

			// Misc earnings (gifts, team trials, careers) is a flat approximation
			// gated behind the user's toggle. It drips DAILY rather than landing
			// as a periodic lump, but only after a 30-day ramp-in counted from
			// `today`: days 1..30 earn nothing, then every day earns 60. A banner
			// ending inside the ramp-in still gets none of it. Anchoring to
			// `today` (not to lastEndDate) keeps the drip's start instant
			// absolute, so the day counts tile no matter how the timeline is
			// sliced into banner windows.
			if (userStatsData.misc_earnings) {
				freeCarats +=
					MISC_EARNINGS_PER_DAY *
					countDaysAfterDelay(
						lastEndDate,
						endDate,
						today,
						MISC_EARNINGS_DELAY_DAYS
					)
			}

			// The 50-day login campaign is universal (no toggle) and pays as a
			// lump on a rolling cycle anchored to `today` (unlike misc earnings
			// above, which drips daily), so the first payout lands 50 days out
			// and a banner ending sooner earns none of it.
			freeCarats +=
				FIFTY_DAY_LOGIN_PER_CYCLE *
				calculateIntervalOccurrences(
					lastEndDate,
					endDate,
					today,
					FIFTY_DAY_LOGIN_CYCLE_DAYS
				)

			// Valentine's Day and White Day gifts — fixed calendar dates rather
			// than rolling cycles, so they use absolute annual occurrences (like
			// the 1st-of-month incomes) instead of an anchor.
			freeCarats +=
				VALENTINES_CARATS *
				calculateAnnualDateOccurrences(
					lastEndDate,
					endDate,
					VALENTINES_MONTH,
					VALENTINES_DAY
				)
			freeCarats +=
				WHITE_DAY_CARATS *
				calculateAnnualDateOccurrences(
					lastEndDate,
					endDate,
					WHITE_DAY_MONTH,
					WHITE_DAY_DAY
				)

			// Monthly shop tickets: a fixed uma/support ticket bundle buyable
			// each month (with an untracked currency), so no carat cost.
			if (userStatsData.monthly_shop_tickets) {
				umaTickets += MONTHLY_SHOP_UMA_TICKETS * months
				supportTickets += MONTHLY_SHOP_SUPPORT_TICKETS * months
			}

			// Training Pass (paid and free tiers) only exists from August 15, 2027;
			// the helper owns that gate plus the differing carat/ticket schedules.
			// Its carats arrive split across both balances (the paid tier's 2,200
			// is 1,850 free + 350 paid), so credit each to its own pool — same
			// shape as the Daily Carat Pack above.
			const trainingPass = getTrainingPassIncome(
				lastEndDate,
				endDate,
				userStatsData.training_pass
			)
			freeCarats += trainingPass.freeCarats
			paidCarats += trainingPass.paidCarats
			umaTickets += trainingPass.umaTickets
			supportTickets += trainingPass.supportTickets

			// Discounted pulls are a once-per-day feature, so the cap is the
			// number of days in this banner's OWN window (not the income-tiling
			// window), measured from the banner's START — NOT from today, even
			// when the banner is already live.
			//
			// Anchoring to today was the obvious reading ("you can't take a
			// discount on a day that already happened"), but it made the cap
			// shrink by one every day a banner was running: a plan the user
			// tuned on the banner's opening day silently became unaffordable a
			// few days later, forcing them to re-tune pull counts mid-banner for
			// no decision-relevant reason. Keying off the fixed window length
			// makes a banner's discount allowance — and therefore its Max Pulls
			// — stable for as long as it is on screen.
			//
			// Counted as INCLUSIVE CALENDAR DAYS, which needs both the
			// `startOfDay` normalisation and the `+ 1`. Banner windows are stored
			// as `<start>T22:00:00Z` -> `<end>T21:59:59Z`, and the user can take
			// the discount on the opening and closing days even though both are
			// partial. Two separate off-by-ones came out of doing this with a bare
			// `differenceInDays(endDate, start)`:
			//   1. It measures the gaps between days, not the days themselves, so
			//      a Sep 10 -> Sep 22 banner scored 12 instead of 13.
			//   2. The `21:59:59` end is one second short of a whole day, so the
			//      truncating subtraction dropped a second day (12 -> 11).
			// Flooring both ends to local midnight first kills #2, and the `+ 1`
			// kills #1. Working in LOCAL days is deliberate: the banner card
			// renders its Start/End in local time, so the cap now matches the
			// dates the user can see and count on screen.
			//
			// The `?? today` fallback only fires for a timeline with no start
			// date (rows with no END date are already dropped from the walk); it
			// degrades to the days-remaining count rather than inventing a
			// window length out of nothing.
			const bannerStart = timeline?.start_date ? new Date(timeline.start_date) : today
			const discountDays = Math.max(
				0,
				differenceInDays(startOfDay(endDate), startOfDay(bannerStart)) + 1
			)

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

			// Write back to the banner's DISPLAY position, not the walk position,
			// so the row on screen gets its own checkpoint's numbers.
			results[index] = {
				carats: freeCarats + paidCarats,
				maxPossiblePulls: strategy.maxPossiblePulls,
				umaTickets,
				supportTickets,
			}

			freeCarats = strategy.freeCarats
			paidCarats = strategy.paidCarats
			umaTickets = strategy.umaTickets
			supportTickets = strategy.supportTickets

			// The walk order guarantees endDate never goes backwards between
			// checkpoints, but a banner that ALREADY ENDED still sits before
			// `today`. Keep the guard so the cursor never retreats behind the
			// projection's anchor.
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