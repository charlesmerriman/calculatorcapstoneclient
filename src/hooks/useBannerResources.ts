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
	MONTHLY_SHOP_TICKET_DAY,
	SHARDS_PER_CRYSTAL,
} from "../constants/gameConstants"
import {
	calculateDailyIncome,
	calculateMondaysBetween,
	calculateMonthlyOccurrences,
	calculateDayOfMonthOccurrences,
	calculateIntervalOccurrences,
	calculateAnnualDateOccurrences,
	countDaysInWindow,
	countDaysAfterDelay,
	sumRemainingThroughoutCarats,
	sumUncapAccrual,
	getTrainingPassIncome,
} from "../utils/incomeCalculationUtils"
import { applyPullStrategy, allocateReservedCopies } from "../utils/bannerHelpers"
import type { MaxPullBreakdown, ReservedFunding } from "../utils/bannerHelpers"
import { addSelectorTickets } from "../utils/selectorTickets"
import type { SelectorTicketBucket } from "../utils/selectorTickets"
import type {
	UserStats,
	ClubRank,
	TeamTrialsRank,
	ChampionsMeetingRank,
	LeagueOfHeroesRank,
	UserPlannedBanner,
	GameEvent,
	ChampionsMeeting,
	LeagueOfHeroes,
	AnniversaryEvent,
	UserPlannedPurchase
} from "../types"

export interface BannerResources {
	/** Combined free + paid carats available before this banner's spend. */
	carats: number
	/** The free (earned) half of `carats`. Drives the "Carats (Est.)" box. */
	freeCarats: number
	/** The paid (purchased) half of `carats`. Drives the "Paid (Est.)" box. */
	paidCarats: number
	/**
	 * Max pulls this banner could support if all available resources were spent
	 * on it (accounts for the paid-carat pull strategy). Drives "Max Pulls".
	 */
	maxPossiblePulls: number
	/** Which resources those max pulls come from. Drives "Free/Tickets/Paid". */
	maxPullBreakdown: MaxPullBreakdown
	umaTickets: number
	supportTickets: number
	/**
	 * Selector tickets, bucketed by JP cutoff rather than summed — two tickets
	 * with different cutoffs are different resources. Use totalSelectorTickets
	 * for a display number. See utils/selectorTickets.
	 */
	umaSelectorTickets: SelectorTicketBucket[]
	supportSelectorTickets: SelectorTicketBucket[]
	/** SSR crystals available before this banner's reserved copies are paid for. */
	ssrCrystals: number
	/** Leftover SSR shards; SHARDS_PER_CRYSTAL of them make another crystal. */
	ssrShards: number
	/** Cumulative planned real-money spend as of this banner, in USD. */
	usdSpent: number
	/** Which resources paid for this banner's reserved copies. */
	reservedFunding: ReservedFunding
}

/**
 * The zeroed snapshot used wherever a banner has no projection yet — the
 * pre-filled result slots below, and the consumer's fallback for an index with
 * no entry. Exported so those two can't drift apart when a field is added.
 * Frozen because it's shared by reference across every such slot.
 */
export const EMPTY_BANNER_RESOURCES: BannerResources = Object.freeze({
	carats: 0,
	freeCarats: 0,
	paidCarats: 0,
	maxPossiblePulls: 0,
	maxPullBreakdown: Object.freeze({
		freePulls: 0,
		tickets: 0,
		paidPulls: 0,
		freeCaratPulls: 0,
	}),
	umaTickets: 0,
	supportTickets: 0,
	// Plain empty arrays rather than frozen ones: every bucket operation returns
	// a new array (see utils/selectorTickets), so these are never mutated, and
	// freezing them would force a readonly type through the whole consumer chain.
	umaSelectorTickets: [] as SelectorTicketBucket[],
	supportSelectorTickets: [] as SelectorTicketBucket[],
	ssrCrystals: 0,
	ssrShards: 0,
	usdSpent: 0,
	reservedFunding: Object.freeze({ selectors: 0, crystals: 0, unfunded: 0 }),
})

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
	anniversaryEventData: AnniversaryEvent[]
	userPlannedPurchaseData: UserPlannedPurchase[]
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
	userPlannedBannerData,
	anniversaryEventData,
	userPlannedPurchaseData
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

		// Selector tickets and uncap crystals ride alongside the carat balances:
		// spent on reserved copies rather than pulls, so they never enter
		// applyPullStrategy and can never inflate max pulls.
		//
		// The starting holdings enter as a single UNRESTRICTED bucket. We don't
		// know which campaign a user's existing tickets came from, and assuming a
		// cutoff we can't see would silently block cards they can actually pick.
		let umaSelectorTickets = addSelectorTickets(
			[],
			null,
			userStatsData.uma_selector_ticket || 0
		)
		let supportSelectorTickets = addSelectorTickets(
			[],
			null,
			userStatsData.support_selector_ticket || 0
		)
		let ssrCrystals = userStatsData.ssr_crystals || 0
		let ssrShards = userStatsData.ssr_shards || 0
		let usdSpent = 0

		// One result slot per planned banner, pre-filled so the array always
		// lines up positionally with `userPlannedBannerData` — the consumer
		// reads `bannerResources[index]` for the row at the same index. A banner
		// with no resolvable timeline keeps its zeroed slot instead of shifting
		// every later row's result onto the wrong card.
		const results: BannerResources[] = userPlannedBannerData.map(
			() => EMPTY_BANNER_RESOURCES
		)

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

		// Planned purchases, resolved to a credit instant and grouped so the loop
		// can ask "what got bought in this window?" without rescanning campaigns.
		//
		// The credit instant is the campaign's resolved START — packs go on sale
		// when the campaign opens. It is an ABSOLUTE instant, which is what keeps
		// the banner windows tiling: counting purchases per-window instead would
		// inflate totals as soon as a user split their plan across more banners.
		//
		// Campaigns with no resolved date (no linked banner parts) are skipped
		// rather than credited at some fallback — there is no honest instant to
		// pick, and guessing one would move a user's estimate on a date we made up.
		const productsById = new Map(
			anniversaryEventData.flatMap((event) =>
				event.products.map((product) => [product.id, { product, event }] as const)
			)
		)
		const purchaseCredits = userStatsData.include_purchases_in_projection
			? userPlannedPurchaseData.flatMap((purchase) => {
					const entry = productsById.get(purchase.product)
					const startDate = entry?.event.start_date
					if (!entry || !startDate) return []
					const quantity = Math.max(0, purchase.quantity)
					if (quantity === 0) return []
					const { product } = entry
					const multiplier = userStatsData.webstore_bonus
						? product.webstore_multiplier
						: 1
					return [{
						creditAt: new Date(startDate),
						productType: product.product_type,
						jpCutoff: product.jp_cutoff_date,
						// Rounded because a fractional multiplier on an odd carat
						// count can land on a fraction, and carats are whole.
						paidCarats: Math.round(
							product.paid_carat_amount * quantity * multiplier
						),
						usd: product.usd_cost * quantity,
						quantity,
					}]
				})
			: []

		// Selector tickets from planned campaign purchases are banked UP FRONT,
		// not credited into the window their campaign falls in — unlike the paid
		// carats from the very same purchase, which stay window-gated below.
		//
		// The asymmetry is the point. Carats are spent during a banner, so
		// December's carats genuinely cannot buy August's pulls. A selector is not
		// spent at a banner at all: it picks a card out of the back catalogue, and
		// a card stays in that catalogue after its banner ends. Someone planning a
		// July banner around a selector they will hold in December is describing a
		// real, achievable plan, and gating the ticket on the campaign's date
		// refused it — with every campaign sitting in the future relative to a
		// banner running now, that made selectors nearly unusable.
		//
		// What still constrains a ticket is its CUTOFF, carried into the bucket
		// here: it can only ever take cards released on JP on or before that date.
		// That is the real rule, and it does not depend on the calendar.
		//
		// Banking once, outside the walk, is also what keeps a ticket from being
		// spent twice: the pool is decremented as the walk consumes it.
		for (const credit of purchaseCredits) {
			if (credit.productType === "uma_selector") {
				umaSelectorTickets = addSelectorTickets(
					umaSelectorTickets, credit.jpCutoff, credit.quantity
				)
			} else if (credit.productType === "support_selector") {
				supportSelectorTickets = addSelectorTickets(
					supportSelectorTickets, credit.jpCutoff, credit.quantity
				)
			}
		}

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
		// Ordering is stated by the comparator below, NOT inherited from sort
		// stability. An earlier version compared raw end INSTANTS and leaned on
		// stability to keep same-end-date banners in display order. That never
		// fired, because predicted banners don't share an instant — only a
		// rendered date. The backend derives them as
		// `anchor + jp_gap * PREDICTION_FACTOR` (a float times a timedelta), so
		// each one lands on an arbitrary time of day: 07:24:28.800Z here,
		// 21:59:59Z there. formatDate prints local Y/M/D only, so the sheet shows
		// one date for both while getTime() puts them hours apart — and a banner
		// that merely drew an earlier time of day spent first, charging its
		// deduction to a banner that opened weeks before it.
		//
		// So compare at the granularity the sheet actually displays: whole local
		// days, then earliest start day, then display position.
		const walkOrder = userPlannedBannerData
			.map((banner, index) => {
				const timeline =
					banner.banner_uma?.banner_timeline ??
					banner.banner_support?.banner_timeline
				const endDate = timeline?.end_date ? new Date(timeline.end_date) : null
				const startDate = timeline?.start_date
					? new Date(timeline.start_date)
					: null
				return {
					banner,
					index,
					timeline,
					endDate,
					// Sort keys only. All the window arithmetic below still uses the
					// raw `endDate` instant — this changes the order checkpoints are
					// visited in, never the windows themselves.
					endDay: endDate ? startOfDay(endDate).getTime() : null,
					startDay: startDate ? startOfDay(startDate).getTime() : null,
				}
			})
			.filter(
				(entry): entry is typeof entry & { endDate: Date; endDay: number } =>
					entry.endDate !== null && entry.endDay !== null
			)
			.sort((a, b) => {
				// 1. End day ascending — the cursor walks the calendar forward, so
				//    banners closing on genuinely different days keep that order.
				if (a.endDay !== b.endDay) return a.endDay - b.endDay
				// 2. Start day ascending — on a shared closing day the banner that
				//    opened first spends first, so its estimate is never charged for
				//    pulls committed to a banner that opened after it. A banner with
				//    no resolvable start sorts last; it can't claim priority.
				if (a.startDay !== b.startDay) {
					if (a.startDay === null) return 1
					if (b.startDay === null) return -1
					return a.startDay - b.startDay
				}
				// 3. Display position — uma/support pairs share one timeline, so both
				//    keys above tie and the row listed first keeps spend priority.
				return a.index - b.index
			})

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
			// checkpoint and credit only what it added over the last one.
			//
			// Clamped at 0: the walk is ordered by end DAY, so two checkpoints on
			// the same day can be visited slightly out of instant order, and this
			// filter reads the raw instant. Without the clamp that step backwards
			// would REFUND throughout carats already credited. Same-day steps add
			// nothing anyway, so the floor only ever discards noise.
			const throughoutToDate = sumRemainingThroughoutCarats(
				parsedGameEvents,
				nowUtc,
				endDate
			)
			freeCarats += Math.max(0, throughoutToDate - creditedThroughout)
			creditedThroughout = Math.max(creditedThroughout, throughoutToDate)

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

			// Campaign purchases falling in this window. Paid carats, because they
			// were bought — they land in the same pool the Daily Carat Pack's lump
			// does and fund discounted pulls the same way.
			//
			// Carats only. Selector tickets are NOT credited per-window; they are
			// seeded up front — see the fold above purchaseWalk for why.
			for (const credit of purchaseCredits) {
				if (credit.creditAt <= lastEndDate || credit.creditAt > endDate) continue
				paidCarats += credit.paidCarats
				usdSpent += credit.usd
			}

			// Uncap shards and crystals over the same window. Shared with the
			// Uncap Crystals panel so the two can't drift — see sumUncapAccrual.
			const uncap = sumUncapAccrual({
				windowStart: lastEndDate,
				windowEnd: endDate,
				events: parsedGameEvents,
				meetings: parsedMeetings,
				leagueEvents: parsedLoH,
				championsMeetingRank: userChampionsMeetingRank,
				leagueOfHeroesRank: userLeagueOfHeroesRank,
			})
			ssrShards += uncap.ssrShards
			ssrCrystals += uncap.ssrCrystals
			// Convert as we go rather than once at the end: the crystals have to be
			// spendable on reserved copies at THIS checkpoint, not only the last one.
			ssrCrystals += Math.floor(ssrShards / SHARDS_PER_CRYSTAL)
			ssrShards %= SHARDS_PER_CRYSTAL

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
			// each month (with an untracked currency), so no carat cost. The shop
			// stocks it on the 2nd, not on the month boundary Club Rank uses, so
			// this counts its own day-of-month occurrences rather than `months`.
			if (userStatsData.monthly_shop_tickets) {
				const shopMonths = calculateDayOfMonthOccurrences(
					lastEndDate,
					endDate,
					MONTHLY_SHOP_TICKET_DAY
				)
				umaTickets += MONTHLY_SHOP_UMA_TICKETS * shopMonths
				supportTickets += MONTHLY_SHOP_SUPPORT_TICKETS * shopMonths
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

			// Copies taken outside of pulling, paid for with selectors first and
			// SSR crystals second (see allocateReservedCopies for why that order).
			// Independent of the pull strategy above: these resources aren't
			// carats, so they change no pull count — only the copy distribution.
			const featured = isUmaBanner
				? banner.banner_uma?.umas ?? []
				: banner.banner_support?.support_cards ?? []
			// The OLDEST featured card sets the bar, because a selector only has to
			// reach ONE card on the banner — it takes a single card and the user
			// picks which. Gating on the newest (as this once did) let a lone
			// recent unit poison the whole banner: an 11-uma banner with 8 cards
			// inside a selector's cutoff still read as unfundable.
			//
			// Cards with no known release date are skipped rather than treated as
			// old, so an unknown can neither qualify a banner nor block one. A
			// banner whose cards are all unknown yields null, which isCardEligible
			// refuses under any real cutoff.
			const oldestFeaturedJpDate = featured.reduce<string | null>(
				(oldest, card) => {
					if (!card.first_jp_date) return oldest
					return !oldest || card.first_jp_date < oldest
						? card.first_jp_date
						: oldest
				},
				null
			)
			const reserved = allocateReservedCopies({
				reservedCopies: banner.reserved_copies,
				isUmaBanner,
				oldestFeaturedJpDate,
				umaSelectorTickets,
				supportSelectorTickets,
				ssrCrystals,
			})

			// Write back to the banner's DISPLAY position, not the walk position,
			// so the row on screen gets its own checkpoint's numbers.
			results[index] = {
				carats: freeCarats + paidCarats,
				// The same two balances kept apart, so the row can show the
				// purchased share instead of only the merged total.
				freeCarats,
				paidCarats,
				maxPossiblePulls: strategy.maxPossiblePulls,
				maxPullBreakdown: strategy.maxPullBreakdown,
				umaTickets,
				supportTickets,
				umaSelectorTickets,
				supportSelectorTickets,
				ssrCrystals,
				ssrShards,
				usdSpent,
				reservedFunding: reserved.funding,
			}

			freeCarats = strategy.freeCarats
			paidCarats = strategy.paidCarats
			umaTickets = strategy.umaTickets
			supportTickets = strategy.supportTickets
			umaSelectorTickets = reserved.umaSelectorTickets
			supportSelectorTickets = reserved.supportSelectorTickets
			ssrCrystals = reserved.ssrCrystals

			// The walk order only guarantees endDate never goes backwards by a
			// whole DAY — two checkpoints on the same day are ordered by start
			// date, so the second can sit a few hours earlier. A banner that
			// ALREADY ENDED also sits before `today`. Either way the cursor must
			// never retreat; the windows those checkpoints open are backwards and
			// every income helper already clamps them to zero.
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
		userStatsData,
		anniversaryEventData,
		userPlannedPurchaseData
	])
}