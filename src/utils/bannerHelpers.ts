import { PULL_COST_CARATS, DISCOUNTED_PULL_COST_CARATS } from "../constants/gameConstants"
import { PULLS_PER_PITY_COPY } from "./probabilityCalculations"
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
	 * Number of days this banner is active (from today onward). Caps the
	 * discounted-pull count, since the discount is a once-per-day feature.
	 */
	discountDays: number
	/** Whether the once-per-day 50-paid-carat discounted pull is enabled. */
	discountedPaidPulls: boolean
	/** Whether paid carats may be spent normally (150 per pull). */
	fullPricePaidPulls: boolean
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
 * discounted paid pulls (50 paid carats each, one per active day) → free carats
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

	// 3. Discounted paid pulls (paid carats only, one per active day).
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

	return { freeCarats, paidCarats, umaTickets, supportTickets, maxPossiblePulls }
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
