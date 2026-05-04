const SINGLE_ATTEMPT_SUCCESS_RATE = 0.75
const SUCCESS_RATE_DECIMAL = SINGLE_ATTEMPT_SUCCESS_RATE / 100
const SINGLE_ATTEMPT_FAILURE_RATE = 1 - SUCCESS_RATE_DECIMAL

function getExactProbability(pulls: number, k: number): number {
	let combos = 1
	for (let i = 0; i < k; i++) {
		combos *= (pulls - i) / (i + 1)
	}
	return (
		combos *
		Math.pow(SUCCESS_RATE_DECIMAL, k) *
		Math.pow(SINGLE_ATTEMPT_FAILURE_RATE, pulls - k)
	)
}

function applyPityReduction(pulls: number, successNeeded: number): number {
	if (pulls >= 1000) {
		return 0
	} else if (pulls >= 800) {
		return successNeeded - 4
	} else if (pulls >= 600) {
		return successNeeded - 3
	} else if (pulls >= 400) {
		return successNeeded - 2
	} else if (pulls >= 200) {
		return successNeeded - 1
	}
	return successNeeded
}

function cumulativeProbability(pulls: number, minSuccesses: number): number {
	let failProb = 0
	for (let i = 0; i < minSuccesses; i++) {
		failProb += getExactProbability(pulls, i)
	}
	return (1 - failProb) * 100
}

/**
 * Calculates the probability (0-100) of getting at least `successNeeded`
 * copies in `pulls` attempts, accounting for pity thresholds.
 */
export function calculateSuccessProbability(
	pulls: number,
	successNeeded: number
): number {
	if (pulls >= 1000) {
		return 100
	}

	const adjusted = applyPityReduction(pulls, successNeeded)

	if (adjusted <= 0) {
		return 100
	}

	return cumulativeProbability(pulls, adjusted)
}

/**
 * Calculates the probability of getting zero copies (complement of getting at least 1).
 */
export function calculateZeroProbability(pulls: number): number {
	return Math.abs(calculateSuccessProbability(pulls, 1) - 100)
}