const SINGLE_ATTEMPT_SUCCESS_RATE = 0.75
const SUCCESS_RATE_DECIMAL = SINGLE_ATTEMPT_SUCCESS_RATE / 100
const SINGLE_ATTEMPT_FAILURE_RATE = 1 - SUCCESS_RATE_DECIMAL

/**
 * Pulls required to earn one guaranteed copy from the pity exchange.
 *
 * Exported because the UI also keys off it: a planned pull count that lands
 * exactly on a multiple of this spends nothing on a partial, unredeemable pity
 * counter, which is what `getPullCountStatus` signals green.
 */
export const PULLS_PER_PITY_COPY = 200

/**
 * 5 copies = MLB (the card itself plus 4 limit breaks). There is no 5LB, so
 * copies beyond this are wasted and the 5-copy bucket has to absorb them.
 */
export const MAX_COPIES = 5

/**
 * Binomial PMF: the probability of landing exactly `k` successes in `pulls`
 * independent attempts. `combos` is "pulls choose k" built up iteratively to
 * avoid overflowing on large factorials.
 */
function getExactProbability(pulls: number, k: number): number {
	// You cannot succeed more often than you rolled. Guarding here also keeps
	// the loop below from running past `pulls` into negative terms, which would
	// return -0 and render as an invalid `width: -0%` on the bars.
	if (k > pulls) {
		return 0
	}

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

/**
 * Copies the pity exchange hands over for free at this pull count — one per
 * 200 pulls, capped at MLB since further exchanges have nothing left to break.
 */
export function getGuaranteedCopies(pulls: number): number {
	return Math.min(Math.floor(pulls / PULLS_PER_PITY_COPY), MAX_COPIES)
}

/**
 * Probability (0-100) of finishing with at least `copiesNeeded` copies.
 *
 * Pity is modelled as copies already in hand, so the random pulls only have to
 * supply the shortfall. A non-positive shortfall means pity alone gets you
 * there and the result is a certainty.
 */
export function calculateSuccessProbability(
	pulls: number,
	copiesNeeded: number
): number {
	const randomNeeded = copiesNeeded - getGuaranteedCopies(pulls)

	if (randomNeeded <= 0) {
		return 100
	}

	// P(at least n) = 1 - P(0) - P(1) - ... - P(n-1)
	let below = 0
	for (let i = 0; i < randomNeeded; i++) {
		below += getExactProbability(pulls, i)
	}

	// Summing many small floats can drift a hair past 1, which would surface as
	// a negative percentage. Clamp rather than Math.abs — abs would flip a
	// negative into a plausible-looking positive and hide the drift.
	return Math.max(1 - below, 0) * 100
}

/**
 * The full distribution of final copy counts as percentages, indexed by copy
 * count: [exactly 0, exactly 1, ... exactly 4, five-or-more].
 *
 * These are discrete outcomes — each entry is the chance of landing on that
 * result and nothing else — so the array sums to 100. The last entry is the
 * one deliberate exception: extra copies past MLB have nowhere else to go, so
 * that bucket stays cumulative or the total would fall short of 100.
 */
export function calculateCopyDistribution(pulls: number): number[] {
	const guaranteed = getGuaranteedCopies(pulls)

	return Array.from({ length: MAX_COPIES + 1 }, (_, copies) => {
		// Pity already covers `guaranteed` copies, so random pulls need only
		// make up the difference. Totals below the pity floor are unreachable.
		const randomNeeded = copies - guaranteed

		if (randomNeeded < 0) {
			return 0
		}

		return copies === MAX_COPIES
			? calculateSuccessProbability(pulls, copies)
			: getExactProbability(pulls, randomNeeded) * 100
	})
}
