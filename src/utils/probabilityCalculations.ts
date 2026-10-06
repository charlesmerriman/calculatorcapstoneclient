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

/** A batch of independent random attempts that all share one chance. */
export interface AttemptGroup {
	/** How many attempts are in the batch. */
	trials: number
	/**
	 * Per-attempt chance of the card being chased, as a DECIMAL (0.0075, not
	 * 0.75). The one easy mistake to make here, hence the shouting.
	 */
	rate: number
}

/**
 * One banner's odds, reduced to the things that actually vary.
 *
 * Standard banners and step-ups differ only in these numbers — same binomial,
 * same MLB cap, same "copies in hand don't need rolling for" treatment — so
 * they share one implementation instead of two that can drift apart.
 */
export interface CopyDistributionInput {
	/**
	 * The random attempts, grouped by their chance. A standard banner has one
	 * group: its pulls at the chased card's rate-up rate. A step-up has two, because its step 3 and 4
	 * guaranteed slots land on the chased card at 1 in 10, far more often than
	 * an ordinary pull does. See stepUpLadder.ts.
	 */
	attempts: AttemptGroup[]
	/**
	 * Copies handed over outright, never rolled for — pity exchanges on a normal
	 * banner, the step 5 pick on a step-up.
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
	{ trials, rate, guaranteed }: AttemptGroup & { guaranteed: number },
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
 * `copiesNeeded` copies, at `rate` per pull with pity every 200 pulls.
 *
 * `rate` is the chased card's rate-up rate as a decimal, from
 * utils/rateUpRates.ts. It is a parameter, never a module constant, because
 * it varies by banner and the numbers behind it come from the API.
 */
export function calculateSuccessProbability(
	pulls: number,
	copiesNeeded: number,
	rate: number
): number {
	return getAtLeastProbability(
		{ trials: pulls, rate, guaranteed: getGuaranteedCopies(pulls) },
		copiesNeeded
	)
}

/**
 * The chance of EXACTLY 0, 1, ... MAX_COPIES - 1 random hits across every
 * group of attempts, as decimals.
 *
 * Groups combine by convolution: the chance of k hits in total is the sum,
 * over every way of splitting k between the groups, of the chances of each
 * side of the split. One step-up round, 47 pulls at 0.3% plus 2 slots at 10%:
 *
 *     P(0 total) = P(0 from pulls) * P(0 from slots)
 *     P(1 total) = P(1 from pulls) * P(0 from slots)
 *                + P(0 from pulls) * P(1 from slots)
 *     P(2 total) = P(2, 0) + P(1, 1) + P(0, 2)       ...and so on
 *
 * Only counts below MLB are kept. That loses nothing: a low total can only be
 * made of low counts from each group, so the truncated arrays still combine
 * exactly. Everything at or past MLB is recovered by the caller as "whatever
 * probability is left over".
 */
function randomHitsBelowCap(attempts: AttemptGroup[]): number[] {
	// Before any attempt, zero hits is a certainty. Starting from this rather
	// than from the first group means one group passes through untouched
	// (x * 1 and x + 0 are exact), so a standard banner's odds come out
	// bit-for-bit the same as the single-binomial code this replaced.
	let combined: number[] = Array.from({ length: MAX_COPIES }, (_, hits) =>
		hits === 0 ? 1 : 0
	)

	for (const { trials, rate } of attempts) {
		const group = Array.from({ length: MAX_COPIES }, (_, hits) =>
			getExactProbability(trials, hits, rate)
		)

		combined = combined.map((_, total) => {
			let sum = 0
			for (let fromGroup = 0; fromGroup <= total; fromGroup++) {
				sum += combined[total - fromGroup] * group[fromGroup]
			}
			return sum
		})
	}

	return combined
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
export function copyDistribution({
	attempts,
	guaranteed,
}: CopyDistributionInput): number[] {
	// Guarantees past MLB are real but unusable — a long step-up ladder can hand
	// over more than five. Clamping here rather than at each call site keeps a
	// caller from silently producing an all-zero distribution.
	const floor = Math.min(Math.max(0, Math.floor(guaranteed)), MAX_COPIES)
	const random = randomHitsBelowCap(attempts)

	// Guarantees already cover `floor` copies, so random attempts need only
	// make up the difference. Totals below that floor are unreachable.
	const exact = Array.from({ length: MAX_COPIES }, (_, copies) =>
		copies < floor ? 0 : random[copies - floor] * 100
	)

	// The MLB bucket is 1 minus every random count that falls short of it.
	// Summing many small floats can drift a hair past 1, which would surface as
	// a negative percentage. Clamp rather than Math.abs — abs would flip a
	// negative into a plausible-looking positive and hide the drift.
	let shortOfMlb = 0
	for (let hits = 0; hits < MAX_COPIES - floor; hits++) {
		shortOfMlb += random[hits]
	}

	return [...exact, Math.max(1 - shortOfMlb, 0) * 100]
}

/**
 * The copy distribution for a STANDARD banner at `pulls` pulls, at `rate` per
 * pull (the chased card's rate-up rate; see utils/rateUpRates.ts), with pity
 * credited every 200 pulls.
 */
export function calculateCopyDistribution(pulls: number, rate: number): number[] {
	return copyDistribution({
		attempts: [{ trials: pulls, rate }],
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
