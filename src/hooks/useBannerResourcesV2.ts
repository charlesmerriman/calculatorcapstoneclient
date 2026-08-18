/**
 * The ledger-based income engine.
 *
 * HOW THIS DIFFERS FROM useBannerResources
 * ----------------------------------------
 * The original hook is an incremental WALK: a cursor steps banner to banner and
 * accrues income into chained half-open `(prevEnd, thisEnd]` windows. Every
 * income source needs its own occurrence counter and every counter has to tile —
 * `(a,b] + (b,c] === (a,c]` — or totals drift with how many banners the user
 * planned. That requirement produced a long run of drift bugs against the source
 * spreadsheet.
 *
 * This engine does what the sheet does. Income for a banner is an ABSOLUTE
 * cumulative total from today to that banner's own end date (see
 * ./utils/cumulativeIncome and ./utils/incomeLedger), computed independently of
 * every other banner. Spend is then subtracted as a running total of what the
 * banners resolving earlier committed — the sheet's `AW42`, a self-join over the
 * banner rows.
 *
 * The consequence worth internalising: **banner order no longer affects income
 * at all.** It only decides who has already spent by the time a given banner is
 * reached. That is why this is still a single forward pass and not something
 * quadratic — it just carries spend rather than income.
 *
 * Returns the same `BannerResources[]`, positionally aligned with
 * `userPlannedBannerData`, as the engine it replaces.
 */

import { useMemo } from "react"
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
import { startOfUtcDay, utcDaysBetween } from "../utils/utcDates"
import { applyPullStrategy, allocateReservedCopies } from "../utils/bannerHelpers"
import { addSelectorTickets } from "../utils/selectorTickets"
import type { SelectorTicketBucket } from "../utils/selectorTickets"
import { EMPTY_BANNER_RESOURCES } from "./bannerResources"
import type { BannerResources } from "./bannerResources"
import type {
	UserStats,
	ClubRank,
	TeamTrialsRank,
	ChampionsMeetingRank,
	LeagueOfHeroesRank,
	UserPlannedBanner,
	AnniversaryEvent,
	UserPlannedPurchase,
	IncomeLedgerRow,
} from "../types"
import type { CalculationConstants } from "../types/constants"

interface BannerResourcesV2Params {
	userStatsData: UserStats | null
	clubRankData: ClubRank[]
	teamTrialsRankData: TeamTrialsRank[]
	championsMeetingRankData: ChampionsMeetingRank[]
	leagueOfHeroesRankData: LeagueOfHeroesRank[]
	userPlannedBannerData: UserPlannedBanner[]
	anniversaryEventData: AnniversaryEvent[]
	userPlannedPurchaseData: UserPlannedPurchase[]
	incomeLedger: IncomeLedgerRow[]
	/** Admin-editable tunables, already overlaid on DEFAULT_CONSTANTS. */
	constants: CalculationConstants
}

/** Running total of what the banners resolving before this one committed. */
interface SpendTotals {
	freeCarats: number
	paidCarats: number
	umaTickets: number
	supportTickets: number
	ssrCrystals: number
}

export function useBannerResourcesV2({
	userStatsData,
	clubRankData,
	teamTrialsRankData,
	championsMeetingRankData,
	leagueOfHeroesRankData,
	userPlannedBannerData,
	anniversaryEventData,
	userPlannedPurchaseData,
	incomeLedger,
	constants,
}: BannerResourcesV2Params): BannerResources[] {
	return useMemo(() => {
		if (!userStatsData) return []

		const results: BannerResources[] = userPlannedBannerData.map(
			() => EMPTY_BANNER_RESOURCES
		)

		// Two anchors, and they are NOT interchangeable — the sheet keeps them
		// apart too. `today` (its $AG$3, TODAY) measures spans, so every estimate
		// on a given calendar day is identical no matter when the page is opened.
		// `now` (its $AG$2, NOW) filters reward instants: an event that already
		// opened today has paid out, and its carats are in the balance the user
		// typed in.
		const now = new Date()
		const today = startOfUtcDay(now)

		const ledger = parseLedger(incomeLedger)

		const clubRank = clubRankData.find((r) => r.id === userStatsData.club_rank)
		const teamTrialsRank = teamTrialsRankData.find(
			(r) => r.id === userStatsData.team_trials_rank
		)
		const championsMeetingRank = championsMeetingRankData.find(
			(r) => r.id === userStatsData.champions_meeting_rank
		)
		const leagueOfHeroesRank = leagueOfHeroesRankData.find(
			(r) => r.id === userStatsData.league_of_heroes_rank
		)

		// Campaign purchases, resolved to the instant they are credited: the
		// campaign's resolved START, because packs go on sale when it opens.
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
						paidCarats: Math.round(
							product.paid_carat_amount * quantity * multiplier
						),
						usd: product.usd_cost * quantity,
						quantity,
					}]
				})
			: []

		// Selector tickets are banked UP FRONT rather than credited at their
		// campaign's date — unlike the paid carats from the very same purchase.
		// A selector is not spent at a banner: it takes a card out of the back
		// catalogue, and a card stays there after its banner ends. What still
		// constrains it is its CUTOFF, which is calendar-independent. Carried
		// through the pass so the pool can't be spent twice.
		let umaSelectorTickets: SelectorTicketBucket[] = addSelectorTickets(
			[], null, userStatsData.uma_selector_ticket || 0
		)
		let supportSelectorTickets: SelectorTicketBucket[] = addSelectorTickets(
			[], null, userStatsData.support_selector_ticket || 0
		)
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

		/**
		 * Everything the user will have earned between today and `end`, before
		 * any spending. A pure function of `end` — nothing about the rest of the
		 * plan reaches it, which is the property the whole rewrite is for.
		 */
		const incomeTo = (end: Date) => {
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

			const freeCarats =
				events.carats +
				cumulativeThroughoutCarats(ledger, now, end, constants) +
				cmCount * (championsMeetingRank?.income_amount ?? 0) +
				lohCount * (leagueOfHeroesRank?.income_amount ?? 0) +
				cumulativeDailyCarats(today, end, constants) +
				cumulativeTeamTrialsCarats(today, end, teamTrialsRank?.income_amount ?? 0) +
				cumulativeClubRankCarats(today, end, clubRank?.income_amount ?? 0) +
				cumulativeLoginAndGiftCarats(today, end, constants) +
				(userStatsData.misc_earnings
					? cumulativeMiscEarningsCarats(today, end, constants)
					: 0) +
				pack.freeCarats +
				pass.freeCarats

			// Campaign packs are PAID carats — they were bought, so they land in
			// the balance that funds discounted pulls. Credited at an absolute
			// instant, never per-window.
			let paidCarats = pack.paidCarats + pass.paidCarats
			let usdSpent = 0
			for (const credit of purchaseCredits) {
				if (credit.creditAt < now || credit.creditAt > end) continue
				paidCarats += credit.paidCarats
				usdSpent += credit.usd
			}

			const umaTickets =
				events.umaTickets +
				cmCount * (championsMeetingRank?.uma_ticket_amount ?? 0) +
				lohCount * (leagueOfHeroesRank?.uma_ticket_amount ?? 0) +
				shop.umaTickets +
				pass.umaTickets
			const supportTickets =
				events.supportTickets +
				cmCount * (championsMeetingRank?.support_ticket_amount ?? 0) +
				lohCount * (leagueOfHeroesRank?.support_ticket_amount ?? 0) +
				shop.supportTickets +
				pass.supportTickets

			const ssrShards =
				events.ssrShards +
				cmCount * (championsMeetingRank?.ssr_shard_amount ?? 0) +
				lohCount * (leagueOfHeroesRank?.ssr_shard_amount ?? 0)

			return {
				freeCarats,
				paidCarats,
				usdSpent,
				umaTickets,
				supportTickets,
				ssrShards,
				ssrCrystals: events.ssrCrystals,
			}
		}

		// THE ORDER. Income no longer depends on it — only spend attribution
		// does, so this decides which banner is charged first when two compete
		// for the same carats.
		//
		// Keyed on the banner's START day, which is the sheet's AH44. The sheet
		// implements the tiebreak by nudging duplicate start dates forward a day
		// each (`AH42 + count of earlier rows sharing that start`); sorting by
		// (start day, display position) is the same ordering without the artifact
		// that a nudged banner can collide with one genuinely starting the next
		// day. A banner with no resolvable end date keeps its zeroed slot.
		const walkOrder = userPlannedBannerData
			.map((banner, index) => {
				const timeline =
					banner.banner_uma?.banner_timeline ??
					banner.banner_support?.banner_timeline
				const endDate = timeline?.end_date ? new Date(timeline.end_date) : null
				const startDate = timeline?.start_date
					? new Date(timeline.start_date)
					: null
				return { banner, index, endDate, startDate }
			})
			.filter(
				(entry): entry is typeof entry & { endDate: Date } => entry.endDate !== null
			)
			.sort((a, b) => {
				const aStart = a.startDate ? startOfUtcDay(a.startDate).getTime() : Infinity
				const bStart = b.startDate ? startOfUtcDay(b.startDate).getTime() : Infinity
				if (aStart !== bStart) return aStart - bStart
				return a.index - b.index
			})

		const spent: SpendTotals = {
			freeCarats: 0,
			paidCarats: 0,
			umaTickets: 0,
			supportTickets: 0,
			ssrCrystals: 0,
		}

		for (const { banner, index, endDate, startDate } of walkOrder) {
			const income = incomeTo(endDate)

			const freeCarats =
				(userStatsData.current_carat || 0) + income.freeCarats - spent.freeCarats
			// Paid is floored at 0 (the sheet's MAX(0, ...) on N43) while free is
			// allowed to go negative — an unaffordable plan surfaces as a carat
			// debt on the free balance, which is what the red state reads.
			const paidCarats = Math.max(
				0,
				(userStatsData.current_paid_carat || 0) + income.paidCarats - spent.paidCarats
			)
			const umaTickets =
				(userStatsData.uma_ticket || 0) + income.umaTickets - spent.umaTickets
			const supportTickets =
				(userStatsData.support_ticket || 0) +
				income.supportTickets -
				spent.supportTickets

			// Shards roll into crystals at this checkpoint, not once at the end,
			// so the crystals are spendable on THIS banner's reserved copies.
			const totalShards = (userStatsData.ssr_shards || 0) + income.ssrShards
			const ssrShards = totalShards % constants.shards_per_crystal
			const ssrCrystals =
				(userStatsData.ssr_crystals || 0) +
				income.ssrCrystals +
				Math.floor(totalShards / constants.shards_per_crystal) -
				spent.ssrCrystals

			// Discounted pulls are once per day, capped by the banner's OWN
			// window measured from its start — not from today, so the allowance
			// doesn't shrink under the user while a banner is running. Inclusive
			// calendar days, matching the sheet's DATEDIF(start, end + 1, "D").
			const bannerStart = startDate ?? today
			const discountDays = Math.max(0, utcDaysBetween(bannerStart, endDate) + 1)

			const isUmaBanner = !!banner.banner_uma
			const freePulls =
				banner.banner_uma?.free_pulls ?? banner.banner_support?.free_pulls ?? 0

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

			// A selector only has to reach ONE card on the banner — it takes a
			// single card and the user picks which — so the OLDEST featured card
			// sets the bar. Cards with no known release date are skipped, so an
			// unknown neither qualifies a banner nor blocks one.
			const featured = isUmaBanner
				? banner.banner_uma?.umas ?? []
				: banner.banner_support?.support_cards ?? []
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

			results[index] = {
				carats: freeCarats + paidCarats,
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
				usdSpent: income.usdSpent,
				reservedFunding: reserved.funding,
			}

			// Bank what this banner committed, so the banners after it start from
			// a balance that already accounts for it.
			spent.freeCarats += freeCarats - strategy.freeCarats
			spent.paidCarats += paidCarats - strategy.paidCarats
			spent.umaTickets += umaTickets - strategy.umaTickets
			spent.supportTickets += supportTickets - strategy.supportTickets
			spent.ssrCrystals += ssrCrystals - reserved.ssrCrystals

			// Selector buckets are a pool rather than a scalar, so they carry
			// directly instead of being differenced.
			umaSelectorTickets = reserved.umaSelectorTickets
			supportSelectorTickets = reserved.supportSelectorTickets
		}

		return results
	}, [
		userStatsData,
		clubRankData,
		teamTrialsRankData,
		championsMeetingRankData,
		leagueOfHeroesRankData,
		userPlannedBannerData,
		anniversaryEventData,
		userPlannedPurchaseData,
		incomeLedger,
		constants,
	])
}
