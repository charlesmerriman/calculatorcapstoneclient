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
	return isSupportOdds(plannedBanner)
		? (["None", "0LB", "1LB", "2LB", "3LB", "MLB"] as const)
		: (["None", "1x", "2x", "3x", "4x", "5x"] as const)
}

/** Whether a row's odds are about support cards (else umas). */
function isSupportOdds(plannedBanner: UserPlannedBanner): boolean {
	const target = plannedBannerTarget(plannedBanner)
	return (
		target.type === "Support" ||
		(target.type === "StepUp" && target.banner.card_type === "support")
	)
}

/**
 * What the player is after on a two-card row: the copies of the first card
 * the exchanges fill before any go to the second, and that cell's label.
 *
 * A support card is chased to MLB, so its target is the top cell. An uma is
 * chased to ONE copy: the extra copies only add a little talent, nothing
 * like a support's limit breaks, so on a double uma rate-up the question is
 * "if I get the one I want, what do I get of the other?", and the target is
 * the 1x cell. `label` drives the caption, the panel and the "1x & 2x" cell
 * prefixes. `copies` is the number the two-card maths should fill A to; it
 * does not read it yet (mlbWithSecondCardDistribution still takes A to MLB
 * on every banner), which is a known gap being fixed separately.
 */
export function oddsTarget(plannedBanner: UserPlannedBanner): {
	copies: number
	label: string
} {
	const labels = oddsLabels(plannedBanner)
	const copies = isSupportOdds(plannedBanner) ? 5 : 1
	return { copies, label: labels[copies] }
}

/** A rate as players read it: 0.0075 -> "0.75%", 0.01 -> "1%". */
export function formatRate(rate: number): string {
	return `${parseFloat((rate * 100).toFixed(2))}%`
}
