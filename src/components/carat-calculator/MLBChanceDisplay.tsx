export const MLBChanceDisplay = ({ pulls, plannedBanner }) => {
	const calculateSuccessProbability = (successNeeded) => {
		const getExactProbability = (k) => {
			// Combinations formula
			let combos = 1
			for (let i = 0; i < k; i++) {
				combos *= (pulls - i) / (i + 1)
			}
			return (
				combos *
				Math.pow(successRateDecimal, k) *
				Math.pow(singleAttemptFailureRate, pulls - k)
			)
		}

		if (pulls >= 1000) {
			return 100
		} else if (pulls >= 800) {
			successNeeded = successNeeded - 4
		} else if (pulls >= 600) {
			successNeeded = successNeeded - 3
		} else if (pulls >= 400) {
			successNeeded = successNeeded - 2
		} else if (pulls >= 200) {
			successNeeded = successNeeded - 1
		}

		const singleAttemptSuccessRate = 0.75
		const successRateDecimal = singleAttemptSuccessRate / 100
		const singleAttemptFailureRate = 1 - successRateDecimal

		const probabilityOfZeroSuccesses = Math.pow(singleAttemptFailureRate, pulls)
		const probabilityOfOneSuccess = 1 - getExactProbability(0)
		const probabilityOfTwoSuccesses =
			1 - getExactProbability(0) - getExactProbability(1)
		const probabilityOfThreeSuccesses =
			1 -
			getExactProbability(0) -
			getExactProbability(1) -
			getExactProbability(2)
		const probabilityOfFourSuccesses =
			1 -
			getExactProbability(0) -
			getExactProbability(1) -
			getExactProbability(2) -
			getExactProbability(3)
		const probabilityOfFiveSuccesses =
			1 -
			getExactProbability(0) -
			getExactProbability(1) -
			getExactProbability(2) -
			getExactProbability(3) -
			getExactProbability(4)

		if (successNeeded === 5) {
			return probabilityOfFiveSuccesses * 100
		} else if (successNeeded === 4) {
			return probabilityOfFourSuccesses * 100
		} else if (successNeeded === 3) {
			return probabilityOfThreeSuccesses * 100
		} else if (successNeeded === 2) {
			return probabilityOfTwoSuccesses * 100
		} else if (successNeeded === 1) {
			return probabilityOfOneSuccess * 100
		} else {
			return 100
		}
	}

	return (
		<div className="border rounded-2xl h-full grid grid-cols-1 bg-gray-100 border-gray-200 lg:mx-4">
			<div className="border-r border-b border-gray-200 grid grid-cols-2 items-center">
				<div className="text-lg font-medium text-gray-700 pr-1 text-right">
					Zero:
				</div>{" "}
				<div className="text-base font-medium">
					{Math.abs(calculateSuccessProbability(1) - 100).toFixed(2)}%
				</div>
			</div>
			<div className="border-b border-r border-gray-200 grid grid-cols-2 items-center">
				<div className="text-lg font-medium text-gray-700 pr-4 text-right">
					{plannedBanner.banner_support ? "LB 0:" : "1x:"}
				</div>{" "}
				<div className="text-base font-medium">
					{Math.abs(calculateSuccessProbability(1).toFixed(2))}%
				</div>
			</div>
			<div className="border-r border-b border-gray-200 grid grid-cols-2 items-center">
				<div className="text-lg font-medium text-gray-700 pr-1 text-right">
					{plannedBanner.banner_support ? "LB 0:" : "2x:"}
				</div>
				<div className="text-base font-medium">
					{Math.abs(calculateSuccessProbability(2).toFixed(2))}%
				</div>
			</div>
			<div className="border-r border-b border-gray-200 grid grid-cols-2 items-center">
				<div className="text-lg font-medium text-gray-700 pr-1 text-right">
					{plannedBanner.banner_support ? "LB 0:" : "3x:"}
				</div>{" "}
				<div className="text-base font-medium">
					{Math.abs(calculateSuccessProbability(3).toFixed(2))}%
				</div>
			</div>
			<div className="border-r border-b border-gray-200 grid grid-cols-2 items-center">
				<div className="text-lg font-medium text-gray-700 pr-1 text-right">
					{plannedBanner.banner_support ? "LB 0:" : "4x:"}
				</div>{" "}
				<div className="text-base font-medium">
					{Math.abs(calculateSuccessProbability(4).toFixed(2))}%
				</div>
			</div>
			<div className="border-r rounded grid border-gray-200 grid-cols-2 items-center">
				<div className="text-lg font-medium text-gray-700 pr-1 text-right">
					{plannedBanner.banner_support ? "LB 0:" : "5x:"}
				</div>{" "}
				<div className="text-base font-medium">
					{Math.abs(calculateSuccessProbability(5).toFixed(2))}%
				</div>
			</div>
		</div>
	)
}
