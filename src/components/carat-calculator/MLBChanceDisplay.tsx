import type { UserPlannedBanner } from "../../types"
import {
	calculateCopyDistribution,
	shiftDistribution,
} from "../../utils/probabilityCalculations"
import { plannedBannerTarget } from "../../utils/bannerHelpers"

interface MLBChanceDisplayProps {
	pulls: number
	plannedBanner: UserPlannedBanner
	/**
	 * Copies already secured with a selector ticket or an SSR crystal. They are
	 * certainties, so they shift the whole distribution right rather than
	 * entering the binomial — see shiftDistribution.
	 *
	 * Only what the user can actually PAY for is passed in; an over-reserved row
	 * would otherwise show odds it hasn't earned.
	 */
	reservedCopies?: number
}

export const MLBChanceDisplay = ({
	pulls,
	plannedBanner,
	reservedCopies = 0
}: MLBChanceDisplayProps) => {
	// Which vocabulary the six cells use. Support cards limit-break, so their
	// copies read 0LB..MLB; umas just stack, so theirs read 1x..5x. A step-up
	// follows its own pool: card_type says which of the two it draws from, and
	// that is the reason a step-up row is per card type rather than the sheet's
	// single pooled row — a pooled row cannot label its own odds column.
	const target = plannedBannerTarget(plannedBanner)
	const isSupport =
		target.type === "Support" ||
		(target.type === "StepUp" && target.banner.card_type === "support")

	const labels = isSupport
		? (["None", "0LB", "1LB", "2LB", "3LB", "MLB"] as const)
		: (["None", "1x", "2x", "3x", "4x", "5x"] as const)

	// Discrete odds per outcome — the six cells sum to 100%, so each one answers
	// "how likely am I to finish here?" rather than "here or better?".
	const values = shiftDistribution(calculateCopyDistribution(pulls), reservedCopies)

	// Bars are scaled against the tallest cell in this row rather than a fixed
	// 0-100%. Spreading one whole distribution across six cells keeps every
	// value small, and an absolute scale would flatten the row into slivers.
	const peak = Math.max(...values)

	return (
		<div className="w-full grid grid-cols-3 sm:grid-cols-6 rounded-lg bg-gray-700 border border-gray-600 overflow-hidden">
			{labels.map((label, i) => (
				<div
					key={label}
					className={`flex flex-col items-center justify-center px-1 py-1.5 text-[10px] leading-tight text-center${i < labels.length - 1 ? " border-r border-gray-600" : ""}${i < 3 ? " border-b border-gray-600 sm:border-b-0" : ""}`}
				>
					<div className="mlb-label">{label}</div>
					<div className="mlb-value">{values[i].toFixed(1)}%</div>
					<div className="h-1 bg-gray-500 rounded-full overflow-hidden mt-0.5 w-full">
						<div
							className="h-full bg-blue-400 rounded-full"
							style={{ width: peak > 0 ? `${(values[i] / peak) * 100}%` : "0%" }}
						/>
					</div>
				</div>
			))}
		</div>
	)
}
