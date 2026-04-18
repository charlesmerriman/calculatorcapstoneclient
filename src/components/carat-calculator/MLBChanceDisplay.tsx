import type { UserPlannedBanner } from "../../types"
import {
	calculateSuccessProbability,
	calculateZeroProbability
} from "../../utils/probabilityCalculations"

interface MLBChanceDisplayProps {
	pulls: number
	plannedBanner: UserPlannedBanner
}

export const MLBChanceDisplay = ({
	pulls,
	plannedBanner
}: MLBChanceDisplayProps) => {
	const isSupport = !!plannedBanner.banner_support

	const labels = isSupport
		? (["None", "0LB", "1LB", "2LB", "3LB", "MLB"] as const)
		: (["None", "1x", "2x", "3x", "4x", "5x"] as const)

	const values = [
		calculateZeroProbability(pulls),
		...([1, 2, 3, 4, 5] as const).map((n) =>
			Math.abs(calculateSuccessProbability(pulls, n))
		)
	]

	return (
		<div className="w-full border border-gray-200 rounded-lg overflow-hidden">
			<div className="text-[9px] font-semibold text-gray-600 text-center bg-gray-100 py-0.5 border-b border-gray-200">
				% Chance to MLB (5x Copies)
			</div>
			<div className="grid grid-cols-6">
				{labels.map((label, i) => (
					<div
						key={label}
						className={`mlb-cell ${i < labels.length - 1 ? "border-r border-gray-200" : ""}`}
					>
						<div className="mlb-label">{label}</div>
						<div className="mlb-value">{values[i].toFixed(1)}%</div>
					</div>
				))}
			</div>
		</div>
	)
}