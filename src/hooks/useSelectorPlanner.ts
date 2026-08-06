/**
 * Derives the Selectors page's view model from the campaign catalogue and the
 * user's planned purchases.
 *
 * Kept out of the components so the page stays presentational and the totals
 * are unit-testable. Nothing here touches the per-banner projection — that
 * lives in useBannerResources and reads the same two arrays independently.
 */

import { useMemo } from "react"
import type {
	AnniversaryEvent,
	AnniversaryEventProduct,
	UserPlannedPurchase,
	UserStats
} from "../types"

export interface PlannedProduct {
	product: AnniversaryEventProduct
	/** The user's planned row, if they've planned this product at all. */
	purchase: UserPlannedPurchase | undefined
	quantity: number
	/** Paid carats this line contributes, webstore bonus already applied. */
	paidCarats: number
	usd: number
}

export interface PlannedCampaign {
	event: AnniversaryEvent
	lines: PlannedProduct[]
	/** This campaign's own totals. */
	paidCarats: number
	usd: number
	/** Running totals through this campaign, in date order — the sheet's "Cumulative". */
	cumulativePaidCarats: number
	cumulativeUsd: number
	/** True once the campaign's window has closed; it can no longer be planned. */
	hasPassed: boolean
	/** True when the campaign has no linked banner parts to take dates from. */
	isUndated: boolean
}

export interface SelectorPlan {
	campaigns: PlannedCampaign[]
	totalPaidCarats: number
	totalUsd: number
	/** Selector tickets planned, by type. Display only — the projection buckets them. */
	umaSelectors: number
	supportSelectors: number
}

/**
 * Paid carats one line contributes. Rounded because a fractional multiplier on
 * an odd carat count can land on a fraction, and carats are whole — the same
 * rounding the projection applies, so the page and the banner rows agree.
 */
export function lineCarats(
	product: AnniversaryEventProduct,
	quantity: number,
	webstoreBonus: boolean
): number {
	const multiplier = webstoreBonus ? product.webstore_multiplier : 1
	return Math.round(product.paid_carat_amount * quantity * multiplier)
}

export function useSelectorPlanner(
	anniversaryEventData: AnniversaryEvent[],
	userPlannedPurchaseData: UserPlannedPurchase[],
	userStatsData: UserStats | null
): SelectorPlan {
	return useMemo(() => {
		const webstoreBonus = userStatsData?.webstore_bonus ?? false
		const byProduct = new Map(
			userPlannedPurchaseData.map((purchase) => [purchase.product, purchase])
		)
		// `today` rather than a live instant: a campaign shouldn't flip to
		// "passed" mid-session, and the projection anchors to the same day.
		const today = new Date()

		// Undated campaigns sort last. They can't be projected (see the projection
		// hook — no honest instant to credit them at), so they belong out of the
		// way rather than at the top where a null date would otherwise put them.
		const ordered = [...anniversaryEventData].sort((a, b) => {
			if (!a.start_date && !b.start_date) return a.name.localeCompare(b.name)
			if (!a.start_date) return 1
			if (!b.start_date) return -1
			return new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
		})

		let cumulativePaidCarats = 0
		let cumulativeUsd = 0
		let umaSelectors = 0
		let supportSelectors = 0

		// An explicit loop rather than .map: the cumulative columns are a running
		// total, and accumulating into a closure from inside a map callback is
		// both harder to follow and something the hooks lint rule (rightly)
		// refuses in render.
		const campaigns: PlannedCampaign[] = []
		for (const event of ordered) {
			const lines: PlannedProduct[] = event.products.map((product) => {
				const purchase = byProduct.get(product.id)
				const quantity = purchase?.quantity ?? 0
				return {
					product,
					purchase,
					quantity,
					paidCarats: lineCarats(product, quantity, webstoreBonus),
					usd: product.usd_cost * quantity,
				}
			})

			let paidCarats = 0
			let usd = 0
			for (const line of lines) {
				paidCarats += line.paidCarats
				usd += line.usd
				if (line.quantity <= 0) continue
				if (line.product.product_type === "uma_selector") {
					umaSelectors += line.quantity
				} else if (line.product.product_type === "support_selector") {
					supportSelectors += line.quantity
				}
			}

			cumulativePaidCarats += paidCarats
			cumulativeUsd += usd

			campaigns.push({
				event,
				lines,
				paidCarats,
				usd,
				cumulativePaidCarats,
				cumulativeUsd,
				hasPassed: !!event.end_date && new Date(event.end_date) < today,
				isUndated: !event.start_date,
			})
		}

		return {
			campaigns,
			totalPaidCarats: cumulativePaidCarats,
			totalUsd: cumulativeUsd,
			umaSelectors,
			supportSelectors,
		}
	}, [anniversaryEventData, userPlannedPurchaseData, userStatsData])
}
