/**
 * One button in the stepper pad.
 *
 * `next` is a pure function of the CURRENT value rather than a fixed delta or a
 * fixed target, because the pad holds both kinds at once ("+10" and "Max 340")
 * and the disabled rule below wants to treat them identically.
 */
export interface CountChip {
	label: string
	title: string
	next: (current: number) => number
}

/**
 * The pad's contents, split by row. Two rows rather than one flat list: the
 * deltas are a symmetric four-across ruler and the presets are three wider
 * buttons, and interleaving them made both harder to aim at.
 */
export interface CountChipSet {
	deltas: CountChip[]
	presets: CountChip[]
	/** Footer line teaching the keyboard equivalents. */
	hint: string
}

/**
 * The pull/step quantities this planner actually deals in.
 *
 * The competitor UI this was modelled on offers +100/-100, because its unit of
 * account is a pull. Ours is a pity copy, so the coarse delta is the pity
 * interval (200) and there is a preset that lands exactly on the next one —
 * which is also what turns the field green (see getPullCountStatus).
 *
 * A step-up row is a different unit entirely: `number_of_pulls` carries STEPS
 * there, clamped to `banner_count * 5`, so a plan is 15-25 of them and a
 * hundred-step button would be nonsense. Its ruler is +/-1 and +/-5 (one round).
 *
 * @param upperBound Affordable ceiling — `maxPossiblePulls`, or
 *   `maxPossibleSteps` on a step-up. Only the "Max" preset reads it; the deltas
 *   deliberately step straight past it, because over-planning is surfaced as a
 *   red field rather than prevented (same rule as handlePullCountChange).
 */
export function buildCountChips({
	isStepUp,
	upperBound,
	pullsPerPity,
	stepsPerRound,
}: {
	isStepUp: boolean
	upperBound: number
	pullsPerPity: number
	stepsPerRound: number
}): CountChipSet {
	// Never below zero, matching NumberField's own floor — a "-200" on a row
	// holding 10 lands on 0 rather than refusing to move.
	const by = (amount: number): CountChip["next"] => (current) =>
		Math.max(0, current + amount)

	/**
	 * Round UP to the next multiple, from strictly above the current value. The
	 * `+ 1` is what makes this "advance to the next one" rather than "stay put":
	 * on a row already holding exactly 200, snapping to 200 would be a no-op and
	 * the button would disable itself just when it is most useful.
	 */
	const toNextMultiple = (interval: number): CountChip["next"] => (current) =>
		Math.ceil((current + 1) / interval) * interval

	const clear: CountChip = {
		label: "Clear",
		title: "Set back to zero",
		next: () => 0,
	}

	const max: CountChip = {
		label: `Max ${upperBound}`,
		title: isStepUp
			? "Every step this banner's carats can pay for"
			: "Every pull this banner's carats, tickets and free pulls can pay for",
		next: () => upperBound,
	}

	if (isStepUp) {
		return {
			deltas: [
				{ label: `−${stepsPerRound}`, title: `One round fewer (${stepsPerRound} steps)`, next: by(-stepsPerRound) },
				{ label: "−1", title: "One step fewer", next: by(-1) },
				{ label: "+1", title: "One step more", next: by(1) },
				{ label: `+${stepsPerRound}`, title: `One round more (${stepsPerRound} steps)`, next: by(stepsPerRound) },
			],
			presets: [
				max,
				{
					label: "Next round",
					title: `Round up to a complete ladder (a multiple of ${stepsPerRound} steps)`,
					next: toNextMultiple(stepsPerRound),
				},
				clear,
			],
			hint: `↑↓ ±1 · Shift ±${stepsPerRound}`,
		}
	}

	return {
		deltas: [
			{ label: `−${pullsPerPity}`, title: `One pity copy fewer (${pullsPerPity} pulls)`, next: by(-pullsPerPity) },
			{ label: "−10", title: "One multi fewer (10 pulls)", next: by(-10) },
			{ label: "+10", title: "One multi more (10 pulls)", next: by(10) },
			{ label: `+${pullsPerPity}`, title: `One pity copy more (${pullsPerPity} pulls)`, next: by(pullsPerPity) },
		],
		presets: [
			max,
			{
				label: "Next pity",
				title: `Round up to the next pity threshold (a multiple of ${pullsPerPity} pulls)`,
				next: toNextMultiple(pullsPerPity),
			},
			clear,
		],
		hint: `↑↓ ±1 · Shift ±10 · Ctrl ±${pullsPerPity}`,
	}
}
