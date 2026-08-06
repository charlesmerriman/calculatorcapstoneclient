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

/**
 * Shift a copy distribution right by copies obtained outside of pulling — a
 * selector ticket or an SSR crystal spent on this banner's featured card.
 *
 * Those copies are certainties, not probabilities, so they don't belong inside
 * the binomial at all: the pulls still produce whatever they produce, and the
 * reserved copies simply sit on top. That makes this a pure re-indexing of the
 * existing distribution rather than a change to how it is computed:
 *
 *     P(total = k) = P(pulls give k - reserved)      for k < MAX_COPIES
 *     P(total = 5) = P(pulls give >= 5 - reserved)
 *
 * The top bucket absorbs the tail because there is no 5LB — every outcome that
 * would have overshot MLB lands there, which is also what keeps the array
 * summing to 100 (the same reason calculateCopyDistribution makes it cumulative).
 */
export function shiftDistribution(
	distribution: number[],
	reservedCopies: number
): number[] {
	const reserved = Math.max(0, Math.floor(reservedCopies))
	if (reserved === 0) return distribution

	return Array.from({ length: MAX_COPIES + 1 }, (_, copies) => {
		// Below the reserved floor is now unreachable — those copies are already
		// in hand before a single pull.
		if (copies < reserved) return 0

		const fromPulls = copies - reserved
		if (copies < MAX_COPIES) return distribution[fromPulls] ?? 0

		// Fold every outcome at or past the cap into the top bucket.
		return distribution
			.slice(fromPulls)
			.reduce((sum, probability) => sum + probability, 0)
	})
}
