import { PULL_COST_CARATS, DISCOUNTED_PULL_COST_CARATS } from "../constants/gameConstants"
import { PULLS_PER_PITY_COPY } from "./probabilityCalculations"
import { spendSelectorTickets } from "./selectorTickets"
import type { SelectorTicketBucket } from "./selectorTickets"
import type { UserPlannedBanner } from "../types"

/**
 * Inputs to the pull-economics strategy for a single banner. All carat/ticket
 * values are the balances *available before spending on this banner*.
 */
export interface PullStrategyInput {
	/** True for an uma banner (uses uma tickets), false for a support banner. */
	isUmaBanner: boolean
	/** How many pulls the user planned for this banner. */
	plannedPulls: number
	/** Free pulls the banner grants (consumed before any paid resource). */
	freePulls: number
	umaTickets: number
	supportTickets: number
	/** Earned carats — receive nearly all income and are spent at full price. */
	freeCarats: number
	/**
	 * Purchased carats — the only source for discounted pulls. Grows only from
	 * the Daily Carat Pack's repurchase lump; every other income source is free.
	 */
	paidCarats: number
	/**
	 * Length of the banner's window in calendar days (start through end,
	 * inclusive). Caps the discounted-pull count, since the discount is a
	 * once-per-day feature. Deliberately the FULL window length rather than the
	 * days remaining, so the cap can't shrink under a user while the banner is
	 * live — see the derivation in useBannerResources.
	 */
	discountDays: number
	/** Whether the once-per-day 50-paid-carat discounted pull is enabled. */
	discountedPaidPulls: boolean
	/** Whether paid carats may be spent normally (150 per pull). */
	fullPricePaidPulls: boolean
}

/**
 * Decomposition of `maxPossiblePulls` by which resource pays for each pull.
 * Purely for display — the row shows "Free/Tickets/Paid" so a user can see where
 * their pulls come from instead of just how many there are.
 *
 * Normally these four sum exactly to `maxPossiblePulls`. The one exception is a
 * carat DEFICIT (negative `freeCarats`, cascaded from over-planning an earlier
 * banner): each part is clamped at 0 here while the total keeps its own clamp,
 * so the parts can sum HIGHER than the total. That is deliberate — free pulls
 * and tickets really are still available; the deficit is a carat debt, and
 * zeroing the ticket count to make the arithmetic tidy would be a lie.
 */
export interface MaxPullBreakdown {
	/** Free pulls the banner grants. */
	freePulls: number
	/** Matching-type tickets available (uma tickets on uma banners, and vice versa). */
	tickets: number
	/** Pulls funded by PAID carats: discounted (50 each) + the paid share of full-price. */
	paidPulls: number
	/** Pulls funded by FREE carats at full price. */
	freeCaratPulls: number
}

export interface PullStrategyResult {
	/** Balances remaining after actually spending `plannedPulls`. */
	freeCarats: number
	paidCarats: number
	umaTickets: number
	supportTickets: number
	/**
	 * The greatest number of pulls this banner could support if the user threw
	 * *all* available resources at it (ignores `plannedPulls`). Drives the
	 * "Max Pulls" display.
	 */
	maxPossiblePulls: number
	/** Where those max pulls come from. See MaxPullBreakdown. */
	maxPullBreakdown: MaxPullBreakdown
}

/**
 * Applies the pull-payment strategy for one banner. It does two things at once
 * from the same pre-spend state, keeping them consistent:
 *
 *   1. Spends `plannedPulls` and returns the leftover balances to carry to the
 *      next banner.
 *   2. Computes `maxPossiblePulls` — the hypothetical maximum if the user spent
 *      everything on this banner.
 *
 * Spend order (per the product decision): free pulls → matching tickets →
 * discounted paid pulls (50 paid carats each, one per banner day) → free carats
 * at 150 → full-price paid carats at 150. Free carats are spent before paid so
 * that more daily discounts stay available for later banners.
 *
 * Full-price pulls treat free + (enabled) paid carats as one pool of 150-carat
 * pulls, so leftover remainders combine exactly like the game's fungible carats
 * — this is what keeps default (discount-off, full-price-on) projections
 * identical to the old single-pool math. Any pulls that still can't be paid for
 * become a *free-carat* deficit (a negative balance), preserving the existing
 * "insufficient" signalling downstream.
 */
export function applyPullStrategy(input: PullStrategyInput): PullStrategyResult {
	const {
		isUmaBanner,
		plannedPulls,
		freePulls,
		discountDays,
		discountedPaidPulls,
		fullPricePaidPulls,
	} = input

	const matchingTickets = isUmaBanner ? input.umaTickets : input.supportTickets

	// ── maxPossiblePulls (greedy; ignores plannedPulls) ──────────────────────
	// NOTE: `discountDays` is the banner's full window length, so this figure is
	// stable for the life of the banner rather than decaying day by day.
	// Discounted pulls are strictly the cheapest use of paid carats, so use as
	// many as the day cap and paid balance allow, then feed the leftover paid
	// carats into the full-price pool.
	let paidForMax = input.paidCarats
	let discountMaxPulls = 0
	if (discountedPaidPulls) {
		discountMaxPulls = Math.min(
			discountDays,
			Math.floor(paidForMax / DISCOUNTED_PULL_COST_CARATS)
		)
		paidForMax -= discountMaxPulls * DISCOUNTED_PULL_COST_CARATS
	}
	const fullPricePool = input.freeCarats + (fullPricePaidPulls ? paidForMax : 0)
	const fullPriceMaxPulls = Math.floor(fullPricePool / PULL_COST_CARATS)
	// Match the old helper: a large carat deficit can drag the total down, and
	// only the final sum is clamped at 0 (never a negative "Max Pulls").
	const maxPossiblePulls = Math.max(
		0,
		freePulls + matchingTickets + discountMaxPulls + fullPriceMaxPulls
	)

	// ── Attributing full-price pulls to free vs paid carats ──────────────────
	// The full-price pool deliberately merges free and paid carats (see the
	// doc comment above), so "how many of those pulls did paid carats buy?" has
	// no answer until we pick a rule. Use the MARGINAL contribution: how many
	// pulls exist *because* paid carats were added to the pool. That matches the
	// documented spend order — free carats are spent before full-price paid
	// carats — and puts the boundary pull (part free remainder, part paid) in
	// the paid bucket, which is honest: without the paid carats it wouldn't
	// exist at all.
	const freeOnlyPulls = Math.floor(input.freeCarats / PULL_COST_CARATS)
	const maxPullBreakdown: MaxPullBreakdown = {
		freePulls,
		tickets: matchingTickets,
		paidPulls: discountMaxPulls + Math.max(0, fullPriceMaxPulls - freeOnlyPulls),
		// Clamped because a carat deficit makes freeOnlyPulls negative; see the
		// deficit note on MaxPullBreakdown.
		freeCaratPulls: Math.max(0, freeOnlyPulls),
	}

	// ── Actual spend of plannedPulls ─────────────────────────────────────────
	let freeCarats = input.freeCarats
	let paidCarats = input.paidCarats
	let umaTickets = input.umaTickets
	let supportTickets = input.supportTickets
	let remaining = plannedPulls

	// 1. Free pulls.
	remaining = Math.max(0, remaining - freePulls)

	// 2. Matching tickets.
	if (isUmaBanner) {
		const use = Math.min(remaining, umaTickets)
		umaTickets -= use
		remaining -= use
	} else {
		const use = Math.min(remaining, supportTickets)
		supportTickets -= use
		remaining -= use
	}

	// 3. Discounted paid pulls (paid carats only, one per banner-window day).
	if (discountedPaidPulls && remaining > 0) {
		const capacity = Math.min(
			discountDays,
			Math.floor(paidCarats / DISCOUNTED_PULL_COST_CARATS)
		)
		const use = Math.min(remaining, capacity)
		paidCarats -= use * DISCOUNTED_PULL_COST_CARATS
		remaining -= use
	}

	// 4. Full-price pulls: pay from free carats first, then paid (if enabled).
	//    Remainders combine because a 150 pull can be paid from any carats.
	if (remaining > 0) {
		let cost = remaining * PULL_COST_CARATS
		const fromFree = Math.min(freeCarats, cost)
		freeCarats -= fromFree
		cost -= fromFree
		if (fullPricePaidPulls && cost > 0) {
			const fromPaid = Math.min(paidCarats, cost)
			paidCarats -= fromPaid
			cost -= fromPaid
		}
		// Whatever we still couldn't cover becomes a free-carat deficit.
		freeCarats -= cost
	}

	return {
		freeCarats,
		paidCarats,
		umaTickets,
		supportTickets,
		maxPossiblePulls,
		maxPullBreakdown,
	}
}

/**
 * How a planned pull count should be presented to the user.
 *
 *   "over"    — more pulls than the banner's resources can pay for.
 *   "ok"      — lands exactly on a pity threshold (every carat buys a full
 *               guaranteed copy; nothing is stranded in a partial counter).
 *   "neutral" — affordable, but stops part-way through a pity counter.
 */
export type PullCountStatus = "ok" | "neutral" | "over"

/**
 * Classifies a planned pull count for display.
 *
 * The input is deliberately NOT clamped to `maxPulls` anywhere — a user is
 * allowed to plan beyond their means and see the shortfall (the deficit carries
 * forward as a negative carat balance via applyPullStrategy). This function is
 * what turns that into a visible signal instead of a silent one.
 *
 * "over" is checked FIRST because the two states can co-occur: 400 pulls when
 * only 300 are affordable is both on a pity threshold and unaffordable, and
 * "you can't pay for this" is the more actionable of the two.
 *
 * @param maxPulls Upper bound of affordable pulls. Pass `Infinity` where no
 *   bound is known (e.g. a staged banner, which has no projection yet) to opt
 *   out of the "over" state entirely.
 */
export function getPullCountStatus(
	pulls: number,
	maxPulls: number
): PullCountStatus {
	if (pulls > maxPulls) return "over"
	// 0 is a multiple of the pity threshold, but an untouched row is not a
	// planning achievement — greening every empty row would drain the signal.
	if (pulls > 0 && pulls % PULLS_PER_PITY_COPY === 0) return "ok"
	return "neutral"
}

/**
 * How the copies reserved on a banner were paid for.
 *
 * `unfunded` is what the user asked for and could not cover. It is reported, not
 * clamped — the same choice the pull-count input makes, so an over-ambitious
 * plan stays visible instead of silently shrinking.
 */
export interface ReservedFunding {
	selectors: number
	crystals: number
	unfunded: number
}

export interface ReservedCopiesInput {
	/** Copies the user wants outside of pulling. */
	reservedCopies: number
	isUmaBanner: boolean
	/**
	 * JP release date of the OLDEST featured card on this banner — i.e. the
	 * easiest one for a selector to reach.
	 *
	 * A selector needs to clear only ONE card here, not all of them: the ticket
	 * takes a single card and the user picks which. Gating on the newest instead
	 * meant a lone recent unit poisoned the whole banner — an 11-uma banner with
	 * 8 cards inside the cutoff still read as unfundable because of the 9th.
	 *
	 * Cards with no known release date are excluded upstream rather than treated
	 * as old, so they can neither qualify a banner nor block one. All-unknown
	 * yields null, which selectors refuse under a real cutoff.
	 */
	oldestFeaturedJpDate: string | null
	umaSelectorTickets: SelectorTicketBucket[]
	supportSelectorTickets: SelectorTicketBucket[]
	/** SSR crystals available. Support banners only — there is no uma crystal. */
	ssrCrystals: number
}

export interface ReservedCopiesResult {
	funding: ReservedFunding
	umaSelectorTickets: SelectorTicketBucket[]
	supportSelectorTickets: SelectorTicketBucket[]
	ssrCrystals: number
}

/**
 * Decide which resources pay for a banner's reserved copies, and spend them.
 *
 * Selectors go FIRST, then crystals. Selectors are the constrained resource —
 * they are cutoff-gated and can only ever take older cards — while an SSR
 * crystal takes anything. Spending the constrained one while it happens to
 * qualify preserves the flexible one for a banner where nothing else works.
 * Within selectors the weakest qualifying ticket goes first, for the same reason
 * one level down (see utils/selectorTickets).
 *
 * On an UMA banner only selectors apply: crystals are a support-card currency
 * and this data model has no ★3 equivalent.
 *
 * Pure and total — never throws, never returns negatives. The caller owns what
 * an unfunded remainder means for display.
 */
export function allocateReservedCopies(
	input: ReservedCopiesInput
): ReservedCopiesResult {
	const wanted = Math.max(0, Math.floor(input.reservedCopies))
	const result: ReservedCopiesResult = {
		funding: { selectors: 0, crystals: 0, unfunded: 0 },
		umaSelectorTickets: input.umaSelectorTickets,
		supportSelectorTickets: input.supportSelectorTickets,
		ssrCrystals: input.ssrCrystals,
	}
	if (wanted === 0) return result

	const pool = input.isUmaBanner
		? input.umaSelectorTickets
		: input.supportSelectorTickets
	const { buckets, spent } = spendSelectorTickets(
		pool,
		wanted,
		input.oldestFeaturedJpDate
	)
	result.funding.selectors = spent
	if (input.isUmaBanner) {
		result.umaSelectorTickets = buckets
	} else {
		result.supportSelectorTickets = buckets
	}

	let remaining = wanted - spent
	if (remaining > 0 && !input.isUmaBanner) {
		const fromCrystals = Math.min(remaining, Math.max(0, input.ssrCrystals))
		result.funding.crystals = fromCrystals
		result.ssrCrystals = input.ssrCrystals - fromCrystals
		remaining -= fromCrystals
	}

	result.funding.unfunded = remaining
	return result
}

/**
 * Classifies a reserved-copy count for display, mirroring getPullCountStatus.
 * "over" whenever any part of the request can't be paid for.
 */
export function getReservedStatus(funding: ReservedFunding): PullCountStatus {
	if (funding.unfunded > 0) return "over"
	if (funding.selectors + funding.crystals > 0) return "ok"
	return "neutral"
}

/**
 * Returns the free pull count for a planned banner, or empty string if no banner is set.
 *
 * TYPESCRIPT CONCEPT: Union Return Types
 *
 * This function returns `number | string` because it serves double duty:
 * a numeric value for calculations AND a display value ("" for empty state).
 * In a larger codebase, you might separate these concerns — one function
 * for the numeric value (returning number | null) and the component handles
 * the display formatting. But for a simple helper like this, the union is fine.
 */
export function getFreePulls(
	plannedBanner: UserPlannedBanner
): number | string {
	if (plannedBanner.banner_support) return plannedBanner.banner_support.free_pulls
	if (plannedBanner.banner_uma) return plannedBanner.banner_uma.free_pulls
	return ""
}

/**
 * Identity key for a planned banner.
 *
 * BannerUma and BannerSupport are SEPARATE Django tables with independent
 * autoincrement primary keys, so a bare `id` is ambiguous across the two —
 * uma #1 and support #1 are unrelated banners. Worse, the seed data was
 * populated in lockstep, so matching ids very often point at the same
 * BannerTimeline and therefore the same dates. Comparing planned banners by
 * bare id made "add the uma banner" wrongly mark the same-date support banner
 * as already planned, and vice versa.
 *
 * Every identity comparison must therefore carry the banner's type alongside
 * its id, which is what this key encodes.
 *
 * TYPESCRIPT CONCEPT: Template Literal Types
 *
 * Typing this as `` `uma:${number}` | `support:${number}` `` rather than plain
 * `string` is deliberate: it makes passing a bare id where a key is expected a
 * compile error, which is precisely the mistake this helper exists to prevent.
 */
export type BannerKey = `uma:${number}` | `support:${number}`

export function bannerKey(type: "Uma" | "Support", id: number): BannerKey {
	return type === "Uma" ? `uma:${id}` : `support:${id}`
}

/**
 * Key for a planned/staged row, or null when the row has no banner selected
 * yet. Callers comparing two rows must treat null as "never equal" — two blank
 * rows are not duplicates of each other.
 */
export function plannedBannerKey(
	plannedBanner: Pick<UserPlannedBanner, "banner_uma" | "banner_support">
): BannerKey | null {
	if (plannedBanner.banner_uma) return bannerKey("Uma", plannedBanner.banner_uma.id)
	if (plannedBanner.banner_support) return bannerKey("Support", plannedBanner.banner_support.id)
	return null
}
