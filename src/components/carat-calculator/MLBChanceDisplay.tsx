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
							style={{ width: `${Math.min(values[i], 100)}%` }}
						/>
					</div>
				</div>
			))}
		</div>
	)
}
