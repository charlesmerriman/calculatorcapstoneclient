import type { UserPlannedBanner } from "../types"
import { plannedBannerTarget } from "./bannerHelpers"
import { MAX_COPIES, isTargetCopies } from "./probabilityCalculations"

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

/** A two-card target: the copies the first card is taken to, and its label. */
export interface OddsTarget {
	copies: number
	label: string
}

/**
 * The word for a target: the strip's own cell for that many copies, so the
 * toggle reads 1x..5x on an uma banner and 0LB..MLB on a support banner, the
 * same words as the cells under it.
 */
function targetLabel(plannedBanner: UserPlannedBanner, copies: number): string {
	return oddsLabels(plannedBanner)[copies]
}

/**
 * What the player is after on a two-card row: the copies of the first card
 * the free copies (exchanges and reserved copies) fill before any go to the
 * second, and that cell's label.
 *
 * The row's saved choice (`primary_target`, from the panel's toggle) when it
 * holds one the strip can show; otherwise the default for the banner type. A
 * support card is chased to MLB, so its default is the top cell. An uma is
 * chased to ONE copy: the extra copies only add a little talent, nothing
 * like a support's limit breaks, so on a double uma rate-up the question is
 * "if I get the one I want, what do I get of the other?", and the default is
 * the 1x cell. A saved value outside 1..MLB is ignored, never an error, the
 * same as a stale card id.
 *
 * `copies` is what twoCardDistribution fills the first card to; `label`
 * drives the caption, the panel and the "1x & 2x" cell prefixes.
 */
export function oddsTarget(plannedBanner: UserPlannedBanner): OddsTarget {
	const saved = plannedBanner.primary_target
	const copies = isTargetCopies(saved)
		? saved
		: isSupportOdds(plannedBanner)
			? MAX_COPIES
			: 1
	return { copies, label: targetLabel(plannedBanner, copies) }
}

/** The targets the panel's toggle offers: every count from one copy to MLB. */
export function oddsTargetChoices(plannedBanner: UserPlannedBanner): OddsTarget[] {
	return Array.from({ length: MAX_COPIES }, (_, i) => i + 1).map((copies) => ({
		copies,
		label: targetLabel(plannedBanner, copies),
	}))
}

/** A rate as players read it: 0.0075 -> "0.75%", 0.01 -> "1%". */
export function formatRate(rate: number): string {
	return `${parseFloat((rate * 100).toFixed(2))}%`
}
