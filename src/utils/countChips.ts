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
 * The pad's contents, split by GROUP rather than by row — they render as one
 * row with a divider between them. The deltas are a symmetric ruler and the
 * presets are jump-to-a-value buttons; keeping them apart in the data is what
 * lets the pad draw that divider without hard-coding an index.
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
 *   Pass Infinity when there is no ceiling to know — a STAGED row is not on the
 *   sheet, so useBannerResources has projected nothing for it — and the Max chip
 *   is dropped rather than invented. That is the same opt-out the staged row
 *   already hands getPullCountStatus to suppress the "over" state.
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

	/**
	 * Spread into the presets, so an unknown ceiling drops the chip instead of
	 * rendering one. Neither degenerate alternative is acceptable: "Max Infinity"
	 * is not a button, and a Max that quietly meant 0 would wipe a field the user
	 * had just filled in.
	 */
	const maxGroup: CountChip[] = Number.isFinite(upperBound)
		? [
				{
					label: `Max ${upperBound}`,
					title: isStepUp
						? "Every step this banner's carats can pay for"
						: "Every pull this banner's carats, tickets and free pulls can pay for",
					next: () => upperBound,
				},
		  ]
		: []

	if (isStepUp) {
		return {
			deltas: [
				{ label: `−${stepsPerRound}`, title: `One round fewer (${stepsPerRound} steps)`, next: by(-stepsPerRound) },
				{ label: "−1", title: "One step fewer", next: by(-1) },
				{ label: "+1", title: "One step more", next: by(1) },
				{ label: `+${stepsPerRound}`, title: `One round more (${stepsPerRound} steps)`, next: by(stepsPerRound) },
			],
			presets: [
				...maxGroup,
				{
					label: "Next round",
					title: `Round up to a complete ladder (a multiple of ${stepsPerRound} steps)`,
					next: toNextMultiple(stepsPerRound),
				},
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
			...maxGroup,
			{
				label: "Next pity",
				title: `Round up to the next pity threshold (a multiple of ${pullsPerPity} pulls)`,
				next: toNextMultiple(pullsPerPity),
			},
		],
		hint: `↑↓ ±1 · Shift ±10 · Ctrl ±${pullsPerPity}`,
	}
}
