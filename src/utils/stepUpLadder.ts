import type { CalculationConstants } from "../types/constants"
import { copyDistribution } from "./probabilityCalculations"
import { SELECTION_SLOTS } from "./stepUpSelection"

/**
 * Steps in one complete ladder — the "5" in every "5xN" label.
 *
 * The ladder's five costs repeat, so a step-up of any length is fully described
 * by one round. That is why the constants are five named fields rather than a
 * table: the sheet's 36-row lookup (`AL360:AN395`) was only ever its way of
 * spelling out a cycle, and it stops at 35 because the table ran out of rows,
 * not because the game does.
 */
export const STEPS_PER_ROUND = 5

/**
 * The steps, by position in a round, whose 10-pull ends in a guaranteed card
 * drawn at random from the player's ten selections. Step 5's guarantee is a
 * different thing (the player picks the card) and is `guaranteedCopies`.
 */
const SELECTION_SLOT_STEPS = [3, 4]

/**
 * The cost of each step within one round, in paid carats — [500, 700, 1000,
 * 1300, 1500] at time of writing, but read from the API constants so it stays
 * editable in admin.
 */
export function stepCosts(constants: CalculationConstants): number[] {
	return [
		constants.step_up_cost_step_1,
		constants.step_up_cost_step_2,
		constants.step_up_cost_step_3,
		constants.step_up_cost_step_4,
		constants.step_up_cost_step_5,
	]
}

/**
 * The two derived quantities every ladder function needs:
 *
 *   partialCum[r] — carats to climb `r` steps into a round, r = 0..4.
 *                   [0, 500, 1200, 2200, 3500]
 *   roundCost     — carats for one whole round. 5,000.
 *
 * Kept private and recomputed per call rather than memoised: it is four adds on
 * a five-element array, and caching it would mean caching against a constants
 * object that can change when the API responds.
 */
function ladderShape(constants: CalculationConstants): {
	partialCum: number[]
	roundCost: number
} {
	const costs = stepCosts(constants)

	// Exclusive running total: entry r is the cost of the r steps BEFORE step
	// r+1, which is exactly what a remainder of r steps costs.
	const partialCum = [0]
	for (let i = 0; i < STEPS_PER_ROUND - 1; i++) {
		partialCum.push(partialCum[i] + costs[i])
	}

	return {
		partialCum,
		roundCost: partialCum[STEPS_PER_ROUND - 1] + costs[STEPS_PER_ROUND - 1],
	}
}

/**
 * Paid carats needed to climb `steps` steps from the bottom.
 *
 * Reproduces the sheet's `XLOOKUP(steps, AN360:AN395, AL360:AL395)` in closed
 * form: whole rounds cost a flat 5,000 each, and the leftover steps cost their
 * partial sum.
 *
 *     cost(n) = floor(n / 5) * 5000 + partialCum[n % 5]
 *
 * Note that 50 pulls up a ladder cost 5,000 against 7,500 at the normal
 * discounted rate — the discount is the entire point of the format.
 */
export function cumulativeStepCost(
	steps: number,
	constants: CalculationConstants
): number {
	const n = Math.max(0, Math.floor(steps))
	const { partialCum, roundCost } = ladderShape(constants)

	return (
		Math.floor(n / STEPS_PER_ROUND) * roundCost +
		partialCum[n % STEPS_PER_ROUND]
	)
}

/**
 * The most steps `paidCarats` can pay for outright — the inverse of
 * `cumulativeStepCost`, and the sheet's `XLOOKUP(N43, AL, AN, , -1, -1)` (the
 * `-1` search mode is "next smaller if no exact match", i.e. round down).
 *
 * Rounds down by construction: a remainder that falls between two steps buys
 * the lower one, because a partially-paid step is not a step.
 *
 * The guard is `!(paidCarats > 0)` rather than `<= 0` so that NaN — which
 * compares false against everything — lands on 0 instead of propagating
 * through the arithmetic into the odds.
 */
export function stepsAffordable(
	paidCarats: number,
	constants: CalculationConstants
): number {
	if (!(paidCarats > 0)) return 0

	const { partialCum, roundCost } = ladderShape(constants)
	const remainder = paidCarats % roundCost

	// Walk down from the most expensive remainder so the first hit is the
	// largest affordable one.
	let extraSteps = 0
	for (let r = STEPS_PER_ROUND - 1; r > 0; r--) {
		if (partialCum[r] <= remainder) {
			extraSteps = r
			break
		}
	}

	return Math.floor(paidCarats / roundCost) * STEPS_PER_ROUND + extraSteps
}

/**
 * How the sheet writes a step count (`P43`, via `AM360:AM395`).
 *
 * "5xN" means N completed banners; a trailing "-r" is r steps into the next
 * one. So 3 is "3", 7 is "5x1-2", 10 is "5x2".
 *
 * Zero is spelled "0" rather than "5x0" — the formula only ever ran over a
 * lookup table whose first row was a plain 0, and "5x0 banners" reads as a
 * mistake.
 */
export function stepLabel(steps: number): string {
	const n = Math.max(0, Math.floor(steps))
	if (n === 0) return "0"

	const rounds = Math.floor(n / STEPS_PER_ROUND)
	const remainder = n % STEPS_PER_ROUND

	if (remainder === 0) return `5x${rounds}`
	if (rounds === 0) return String(remainder)
	return `5x${rounds}-${remainder}`
}

/**
 * Copies of the chased card that `steps` hands over outright — the sheet's
 * `FLOOR(input/5,1)`.
 *
 * One per completed round, from the step-5 "pick the card you want" guarantee.
 * Steps 3 and 4's guaranteed cards are NOT counted here: they are a random one
 * of the ten selections, so they are odds, not certainties. See stepUpPulls.
 */
export function guaranteedCopies(steps: number): number {
	return Math.floor(Math.max(0, steps) / STEPS_PER_ROUND)
}

/**
 * Where the pulls of `steps` steps go, sorted by how likely each is to be the
 * chased card.
 */
export interface StepUpPulls {
	/** Ordinary pulls, each rolling `step_up_target_rate` (0.3%). */
	poolPulls: number
	/**
	 * Steps 3 and 4's guaranteed card, a random one of the ten selections, so
	 * the chased card 1 time in 10.
	 */
	selectionSlots: number
	/** Step 5's "you choose" card: the chased card, every time. */
	guaranteed: number
}

/**
 * Splits `steps` steps into the three kinds of pull a Select Step-Up makes.
 *
 * Every step is a 10-pull, but steps 3, 4 and 5 spend their last pull on a
 * guaranteed card, so one round is:
 *
 *     step           1    2    3    4    5     round total
 *     pool pulls    10   10    9    9    9     47 at 0.3%
 *     selection      -    -    1    1    -      2 at 10%
 *     your pick      -    -    -    -    1      1 for certain
 *
 * A partial round counts only the steps it reached, so 3 steps is 29 pool
 * pulls and 1 selection slot, and 15 steps (three banners) is 141, 6 and 3.
 *
 * The source sheet credits only the step 5 pick and rolls all 50 pulls at
 * 0.3%. We deliberately depart from it here: the two 1-in-10 slots are worth
 * more than 60 ordinary pulls between them, and leaving them out showed a
 * three-banner plan's MLB chance as 7.5% when it is 27.3%.
 */
export function stepUpPulls(
	steps: number,
	constants: CalculationConstants
): StepUpPulls {
	const n = Math.max(0, Math.floor(steps))
	const rounds = Math.floor(n / STEPS_PER_ROUND)
	const remainder = n % STEPS_PER_ROUND

	const selectionSlots =
		rounds * SELECTION_SLOT_STEPS.length +
		SELECTION_SLOT_STEPS.filter((step) => step <= remainder).length
	const guaranteed = guaranteedCopies(n)

	return {
		// Each guaranteed card takes the place of one of its step's ten pulls.
		poolPulls: n * constants.step_up_pulls_per_step - selectionSlots - guaranteed,
		selectionSlots,
		guaranteed,
	}
}

/**
 * The copy-count distribution for a step-up at `chargeableSteps` steps.
 *
 * Four things differ from a standard banner, which is why this cannot just
 * call calculateCopyDistribution:
 *
 *   - the planned number is steps, ten pulls each. Reading it as pulls
 *     understates a 5-step plan by a factor of ten.
 *   - ordinary pulls roll the ~3% pool split across ten selected cards, not
 *     the 0.75% single-featured rate.
 *   - steps 3 and 4 each add a 1-in-10 chance, from their guaranteed card.
 *   - step 5 guarantees a copy each completed round, not one per 200 pulls.
 *
 * The 1-in-10 is `1 / SELECTION_SLOTS` rather than an API constant because it
 * is the shape of the game, not a drop rate: the selection is always exactly
 * ten cards, the same way a round is always exactly five steps. And like
 * `step_up_target_rate`, it never depends on how many slots a player has filled.
 *
 * Takes steps already clamped to what exists (applyStepUpStrategy's
 * `chargeableSteps`), so the odds can never describe a banner that is not there.
 */
export function stepUpCopyDistribution(
	chargeableSteps: number,
	constants: CalculationConstants
): number[] {
	const { poolPulls, selectionSlots, guaranteed } = stepUpPulls(
		chargeableSteps,
		constants
	)

	return copyDistribution({
		attempts: [
			{ trials: poolPulls, rate: constants.step_up_target_rate },
			{ trials: selectionSlots, rate: 1 / SELECTION_SLOTS },
		],
		guaranteed,
	})
}
