import { describe, it, expect } from 'vitest'
import { buildCountChips } from '../utils/countChips'
import type { CountChipSet } from '../utils/countChips'
import { PULLS_PER_PITY_COPY } from '../utils/probabilityCalculations'
import { STEPS_PER_ROUND } from '../utils/stepUpLadder'

const pullChips = (upperBound = 340): CountChipSet =>
	buildCountChips({
		isStepUp: false,
		upperBound,
		pullsPerPity: PULLS_PER_PITY_COPY,
		stepsPerRound: STEPS_PER_ROUND,
	})

const stepChips = (upperBound = 20): CountChipSet =>
	buildCountChips({
		isStepUp: true,
		upperBound,
		pullsPerPity: PULLS_PER_PITY_COPY,
		stepsPerRound: STEPS_PER_ROUND,
	})

/** A chip by its visible label, so a test failure names the button. */
const chip = (set: CountChipSet, label: string) => {
	const found = [...set.deltas, ...set.presets].find((c) => c.label === label)
	if (!found) throw new Error(`no chip labelled "${label}"`)
	return found
}

describe('buildCountChips — pull rows', () => {
	it('offers the pity interval as the coarse delta, not a round hundred', () => {
		// The whole reason this isn't the +100/-100 the feature was modelled on:
		// the unit of account here is a pity copy.
		expect(pullChips().deltas.map((c) => c.label)).toEqual([
			'−200',
			'−10',
			'+10',
			'+200',
		])
	})

	it('steps past the affordable ceiling rather than clamping to it', () => {
		// Over-planning is surfaced as a red field, never rewritten — the same
		// contract handlePullCountChange keeps.
		expect(chip(pullChips(340), '+200').next(300)).toBe(500)
	})

	it('floors a negative delta at zero', () => {
		expect(chip(pullChips(), '−200').next(10)).toBe(0)
	})

	it('sets Max to the affordable ceiling exactly', () => {
		expect(chip(pullChips(340), 'Max 340').next(0)).toBe(340)
	})

	it('advances Next pity from a value already on a threshold', () => {
		// The `+1` inside toNextMultiple. Landing on 200 again would disable the
		// button (next === current) precisely when someone wants their second copy.
		expect(chip(pullChips(), 'Next pity').next(200)).toBe(400)
		expect(chip(pullChips(), 'Next pity').next(0)).toBe(200)
		expect(chip(pullChips(), 'Next pity').next(150)).toBe(200)
	})

	it('never leaves Next pity spent, at any value', () => {
		const next = chip(pullChips(), 'Next pity').next
		for (const value of [0, 1, 199, 200, 201, 999]) {
			expect(next(value)).toBeGreaterThan(value)
		}
	})

	it('spends Max at the ceiling and a negative delta at zero', () => {
		// The pad disables a chip whose next() is a no-op; these are the ones
		// meant to reach that state.
		expect(chip(pullChips(340), 'Max 340').next(340)).toBe(340)
		expect(chip(pullChips(340), '−200').next(0)).toBe(0)
	})

	it('is six chips, in one row, with no Clear', () => {
		// The pad renders deltas and presets on a SINGLE line now, and its width
		// is the sum of these labels — so the contents are a layout constraint,
		// not just a feature list. Clear was cut to buy the row: the field is a
		// text input you can select and retype, and '−200' already floors at 0.
		const set = pullChips()
		expect([...set.deltas, ...set.presets].map((c) => c.label)).toEqual([
			'−200',
			'−10',
			'+10',
			'+200',
			'Max 340',
			'Next pity',
		])
	})
})

describe('buildCountChips — rows with no projected ceiling', () => {
	// A STAGED row isn't on the sheet, so useBannerResources has projected no
	// affordability bound for it. It passes Infinity — the same opt-out it gives
	// getPullCountStatus to suppress the "over" state.
	it('drops Max rather than offering "Max Infinity"', () => {
		const set = pullChips(Infinity)
		expect([...set.deltas, ...set.presets].map((c) => c.label)).toEqual([
			'−200',
			'−10',
			'+10',
			'+200',
			'Next pity',
		])
	})

	it('drops Max on a step-up row too', () => {
		expect(stepChips(Infinity).presets.map((c) => c.label)).toEqual(['Next round'])
	})

	it('keeps the ruler and Next pity working without a ceiling', () => {
		// The chips that don't read upperBound must be untouched by its absence.
		expect(chip(pullChips(Infinity), '+200').next(300)).toBe(500)
		expect(chip(pullChips(Infinity), 'Next pity').next(150)).toBe(200)
	})
})

describe('buildCountChips — step-up rows', () => {
	it('counts in steps and rounds, never in pulls', () => {
		// A step-up ladder tops out around 25 steps; a +200 here would be nonsense.
		expect(stepChips().deltas.map((c) => c.label)).toEqual(['−5', '−1', '+1', '+5'])
	})

	it('rounds up to a complete ladder', () => {
		expect(chip(stepChips(), 'Next round').next(0)).toBe(5)
		expect(chip(stepChips(), 'Next round').next(5)).toBe(10)
		expect(chip(stepChips(), 'Next round').next(7)).toBe(10)
	})

	it('takes its Max from the step ceiling', () => {
		expect(chip(stepChips(20), 'Max 20').next(3)).toBe(20)
	})

	it('advertises no Ctrl shortcut, because NumberField is given no large step', () => {
		expect(stepChips().hint).not.toMatch(/Ctrl/)
		expect(pullChips().hint).toMatch(/Ctrl ±200/)
	})
})
