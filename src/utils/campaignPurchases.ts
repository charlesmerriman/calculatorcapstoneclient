/**
 * Shared arithmetic for planned campaign purchases.
 *
 * Lives in utils rather than in either hook because BOTH read it: the Selectors
 * page totals (`useSelectorPlanner`) and the per-banner projection
 * (`useBannerResources`). A user sees the two at once, so a second copy of this
 * rounding would eventually disagree with the first.
 */

import type { AnniversaryEventProduct } from "../types"

export interface PurchaseCarats {
	/** The pack's own carats — bought, so they fund discounted pulls and step-ups. */
	paidCarats: number
	/** The webstore bonus on top, which the game grants as FREE carats. */
	freeCarats: number
}

/**
 * The carats one planned line contributes, split by kind.
 *
 * The webstore sells the same packs with extra carats, but that extra arrives
 * as free currency — so the multiplier is NOT folded into `paidCarats`. With
 * the bonus on, a $140 pack still adds only its 11,000 to the paid balance a
 * step-up may spend, and the 2,200 bonus lands in the free pool alongside daily
 * carats and event rewards.
 *
 * The bonus is derived as `total - paid` rather than `paid * (multiplier - 1)`
 * so the two halves always re-sum to exactly the rounded total, with no stray
 * carat appearing or vanishing at the boundary. Rounded at all because a
 * fractional multiplier on an odd carat count lands on a fraction, and carats
 * are whole.
 */
export function purchaseCarats(
	product: AnniversaryEventProduct,
	quantity: number,
	webstoreBonus: boolean
): PurchaseCarats {
	const paidCarats = product.paid_carat_amount * quantity
	if (!webstoreBonus) return { paidCarats, freeCarats: 0 }
	const total = Math.round(paidCarats * product.webstore_multiplier)
	// Clamped because a multiplier below 1 would otherwise mint negative free
	// carats; the field is a bonus rate, so anything under 1 is bad data.
	return { paidCarats, freeCarats: Math.max(0, total - paidCarats) }
}
