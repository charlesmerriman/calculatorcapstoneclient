/**
 * Per-pull chance of a standard banner's single featured card. Step-up banners
 * run at their own, much lower rate (the ~3% pool rate split ten ways), which
 * is why the binomial below takes a rate rather than closing over this one.
 */
const SINGLE_ATTEMPT_SUCCESS_RATE = 0.75
const SUCCESS_RATE_DECIMAL = SINGLE_ATTEMPT_SUCCESS_RATE / 100

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
 * One banner's odds, reduced to the three things that actually vary.
 *
 * Standard banners and step-ups differ only in these numbers — same binomial,
 * same MLB cap, same "copies in hand don't need rolling for" treatment — so
 * they share one implementation instead of two that can drift apart.
 */
export interface CopyDistributionInput {
	/** Independent random attempts. Pulls on a normal banner; steps x 10 on a step-up. */
	trials: number
	/**
	 * Per-attempt chance of the card being chased, as a DECIMAL (0.0075, not
	 * 0.75). The one easy mistake to make here, hence the shouting.
	 */
	rate: number
	/**
	 * Copies handed over outright, never rolled for — pity exchanges on a normal
	 * banner, completed-round guarantees on a step-up.
	 */
	guaranteed: number
}

/**
 * Binomial PMF: the probability of landing exactly `successes` hits in `trials`
 * independent attempts. `combos` is "trials choose successes" built up
 * iteratively to avoid overflowing on large factorials.
 */
function getExactProbability(
	trials: number,
	successes: number,
	rate: number
): number {
	// You cannot succeed more often than you rolled. Guarding here also keeps
	// the loop below from running past `trials` into negative terms, which would
	// return -0 and render as an invalid `width: -0%` on the bars.
	if (successes > trials) {
		return 0
	}

	let combos = 1
	for (let i = 0; i < successes; i++) {
		combos *= (trials - i) / (i + 1)
	}
	return (
		combos * Math.pow(rate, successes) * Math.pow(1 - rate, trials - successes)
	)
}

/**
 * Probability (0-100) of finishing with at least `copiesNeeded` copies, given
 * the guarantees already in hand.
 *
 * Guarantees are modelled as copies already held, so the random attempts only
 * have to supply the shortfall. A non-positive shortfall means the guarantees
 * alone get you there and the result is a certainty.
 */
function getAtLeastProbability(
	{ trials, rate, guaranteed }: CopyDistributionInput,
	copiesNeeded: number
): number {
	const randomNeeded = copiesNeeded - guaranteed

	if (randomNeeded <= 0) {
		return 100
	}

	// P(at least n) = 1 - P(0) - P(1) - ... - P(n-1)
	let below = 0
	for (let i = 0; i < randomNeeded; i++) {
		below += getExactProbability(trials, i, rate)
	}

	// Summing many small floats can drift a hair past 1, which would surface as
	// a negative percentage. Clamp rather than Math.abs — abs would flip a
	// negative into a plausible-looking positive and hide the drift.
	return Math.max(1 - below, 0) * 100
}

/**
 * Copies the pity exchange hands over for free at this pull count — one per
 * 200 pulls, capped at MLB since further exchanges have nothing left to break.
 */
export function getGuaranteedCopies(pulls: number): number {
	return Math.min(Math.floor(pulls / PULLS_PER_PITY_COPY), MAX_COPIES)
}

/**
 * Probability (0-100) of finishing a STANDARD banner with at least
 * `copiesNeeded` copies. Thin wrapper fixing the featured rate and pity.
 */
export function calculateSuccessProbability(
	pulls: number,
	copiesNeeded: number
): number {
	return getAtLeastProbability(
		{
			trials: pulls,
			rate: SUCCESS_RATE_DECIMAL,
			guaranteed: getGuaranteedCopies(pulls),
		},
		copiesNeeded
	)
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
export function copyDistribution(input: CopyDistributionInput): number[] {
	// Guarantees past MLB are real but unusable — a long step-up ladder can hand
	// over more than five. Clamping here rather than at each call site keeps a
	// caller from silently producing an all-zero distribution.
	const guaranteed = Math.min(
		Math.max(0, Math.floor(input.guaranteed)),
		MAX_COPIES
	)
	const clamped = { ...input, guaranteed }

	return Array.from({ length: MAX_COPIES + 1 }, (_, copies) => {
		// Guarantees already cover `guaranteed` copies, so random attempts need
		// only make up the difference. Totals below that floor are unreachable.
		const randomNeeded = copies - guaranteed

		if (randomNeeded < 0) {
			return 0
		}

		return copies === MAX_COPIES
			? getAtLeastProbability(clamped, copies)
			: getExactProbability(clamped.trials, randomNeeded, clamped.rate) * 100
	})
}

/**
 * The copy distribution for a STANDARD banner at `pulls` pulls: the featured
 * card's 0.75% rate, with pity credited every 200 pulls.
 */
export function calculateCopyDistribution(pulls: number): number[] {
	return copyDistribution({
		trials: pulls,
		rate: SUCCESS_RATE_DECIMAL,
		guaranteed: getGuaranteedCopies(pulls),
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
