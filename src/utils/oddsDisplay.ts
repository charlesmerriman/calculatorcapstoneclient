import type { UserPlannedBanner } from "../types"
import { plannedBannerTarget } from "./bannerHelpers"

/**
 * Small formatting helpers for the odds strip and its two-card controls. Kept
 * out of the component files so those export components only (Fast Refresh).
 */

/**
 * Which vocabulary a row's six cells use. Support cards limit-break, so their
 * copies read 0LB..MLB; umas just stack, so theirs read 1x..5x. A step-up
 * follows its own pool: card_type says which of the two it draws from, and
 * that is the reason a step-up row is per card type rather than the sheet's
 * single pooled row — a pooled row cannot label its own odds column.
 *
 * Shared by the strip and the two-card caption, so the caption names the
 * top cell the way the strip does.
 */
export function oddsLabels(
	plannedBanner: UserPlannedBanner
): readonly string[] {
	const target = plannedBannerTarget(plannedBanner)
	const isSupport =
		target.type === "Support" ||
		(target.type === "StepUp" && target.banner.card_type === "support")

	return isSupport
		? (["None", "0LB", "1LB", "2LB", "3LB", "MLB"] as const)
		: (["None", "1x", "2x", "3x", "4x", "5x"] as const)
}

/** A rate as players read it: 0.0075 -> "0.75%", 0.01 -> "1%". */
export function formatRate(rate: number): string {
	return `${parseFloat((rate * 100).toFixed(2))}%`
}
