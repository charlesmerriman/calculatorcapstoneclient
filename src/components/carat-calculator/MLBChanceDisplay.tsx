import type { UserPlannedBanner } from "../../types"
import {
	calculateSuccessProbability,
	calculateZeroProbability
} from "../../utils/probabilityCalculations"

interface MLBChanceDisplayProps {
	pulls: number
	plannedBanner: UserPlannedBanner
}

/**
 * TYPESCRIPT CONCEPT: Explicit Props Destructuring
 *
 * By defining MLBChanceDisplayProps as a separate interface and
 * referencing it in the function signature, we get:
 *   1. Autocomplete when using <MLBChanceDisplay ... />
 *   2. Compile-time errors if required props are missing
 *   3. Documentation of what this component expects
 *
 * The original component had zero typing on its props — under strict
 * mode, that's a compile error (implicit `any` on parameters).
 */
export const MLBChanceDisplay = ({
	pulls,
	plannedBanner
}: MLBChanceDisplayProps) => {
	const isSupport = !!plannedBanner.banner_support

	/**
	 * TYPESCRIPT CONCEPT: `as const` on Arrays
	 *
	 * Without `as const`, TypeScript infers `labels` as `string[]`.
	 * With `as const`, it infers a readonly tuple of literal strings:
	 *   readonly ["Zero:", "LB 0:", ...]
	 * This is more precise and prevents accidental mutation.
	 * For this use case it's optional, but it's good practice for
	 * constant arrays that should never change.
	 */
	const labels = isSupport
		? (["Zero:", "LB 0:", "LB 1:", "LB 2:", "LB 3:", "LB 4:"] as const)
		: (["Zero:", "1x:", "2x:", "3x:", "4x:", "5x:"] as const)

	return (
		<div className="border rounded-2xl h-full grid grid-cols-1 bg-gray-100 border-gray-200 lg:mx-4">
			<div className="border-r border-b border-gray-200 grid grid-cols-2 items-center">
				<div className="text-lg font-medium text-gray-700 pr-1 text-right">
					{labels[0]}
				</div>
				<div className="text-base font-medium">
					{calculateZeroProbability(pulls).toFixed(2)}%
				</div>
			</div>
			{([1, 2, 3, 4, 5] as const).map((count) => (
				<div
					key={count}
					className={`border-r border-gray-200 grid grid-cols-2 items-center ${
						count < 5 ? "border-b" : "rounded"
					}`}
				>
					<div className="text-lg font-medium text-gray-700 pr-1 text-right">
						{labels[count]}
					</div>
					<div className="text-base font-medium">
						{Math.abs(calculateSuccessProbability(pulls, count)).toFixed(2)}%
					</div>
				</div>
			))}
		</div>
	)
}