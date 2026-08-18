// @vitest-environment node
// Pure math functions — no DOM APIs needed, so we skip jsdom for faster teardown.
import { describe, it, expect } from 'vitest'
import {
  STEPS_PER_ROUND,
  cumulativeStepCost,
  guaranteedCopies,
  stepCosts,
  stepLabel,
  stepUpCopyDistribution,
  stepsAffordable,
} from '../utils/stepUpLadder'
import { DEFAULT_CONSTANTS as C } from '../constants/gameConstants'

// ── stepCosts ─────────────────────────────────────────────────────────────────

describe('stepCosts', () => {
  it('reproduces the sheet ladder AL360:AN364', () => {
    expect(stepCosts(C)).toEqual([500, 700, 1000, 1300, 1500])
  })

  it('is five steps long, matching STEPS_PER_ROUND', () => {
    expect(stepCosts(C)).toHaveLength(STEPS_PER_ROUND)
    expect(STEPS_PER_ROUND).toBe(5)
  })
})

// ── cumulativeStepCost ────────────────────────────────────────────────────────

describe('cumulativeStepCost', () => {
  it('walks the first round one step at a time', () => {
    // The sheet's cumulative column: 500, 1200, 2200, 3500, 5000.
    expect(cumulativeStepCost(0, C)).toBe(0)
    expect(cumulativeStepCost(1, C)).toBe(500)
    expect(cumulativeStepCost(2, C)).toBe(1_200)
    expect(cumulativeStepCost(3, C)).toBe(2_200)
    expect(cumulativeStepCost(4, C)).toBe(3_500)
    expect(cumulativeStepCost(5, C)).toBe(5_000)
  })

  it('repeats the cycle past the first round', () => {
    expect(cumulativeStepCost(6, C)).toBe(5_500)
    expect(cumulativeStepCost(7, C)).toBe(6_200)
    expect(cumulativeStepCost(10, C)).toBe(10_000)
  })

  it('holds at the real ceiling of three banners and beyond', () => {
    // banner_count maxes out at 3, so 15 is the largest step count that can
    // actually exist. The closed form keeps going regardless — the clamp is the
    // engine's job, not the ladder's.
    expect(cumulativeStepCost(15, C)).toBe(15_000)
    expect(cumulativeStepCost(20, C)).toBe(20_000)
    expect(cumulativeStepCost(35, C)).toBe(35_000)
  })

  it('costs 5,000 for the 50 pulls that would otherwise cost 7,500', () => {
    // The whole point of the format. Compared against the standard rate, not
    // the once-per-day discounted paid pull, which is a separate mechanic.
    const pulls = STEPS_PER_ROUND * C.step_up_pulls_per_step
    expect(pulls).toBe(50)
    expect(cumulativeStepCost(STEPS_PER_ROUND, C)).toBe(5_000)
    expect(pulls * C.pull_cost_carats).toBe(7_500)
  })

  it('floors fractional steps and refuses negatives', () => {
    expect(cumulativeStepCost(5.9, C)).toBe(5_000)
    expect(cumulativeStepCost(-3, C)).toBe(0)
  })

  it('reads the ladder from the constants rather than a baked-in table', () => {
    // Guards the "constants come from the API" invariant: an admin edit has to
    // move the numbers, so nothing here may close over the defaults.
    const dearer = { ...C, step_up_cost_step_1: 600 }
    expect(cumulativeStepCost(1, dearer)).toBe(600)
    expect(cumulativeStepCost(5, dearer)).toBe(5_100)
  })
})

// ── stepsAffordable ───────────────────────────────────────────────────────────

describe('stepsAffordable', () => {
  it('buys nothing below the first step', () => {
    expect(stepsAffordable(0, C)).toBe(0)
    expect(stepsAffordable(499, C)).toBe(0)
  })

  it('rounds down — a part-paid step is not a step', () => {
    expect(stepsAffordable(500, C)).toBe(1)
    expect(stepsAffordable(1_199, C)).toBe(1)
    expect(stepsAffordable(1_200, C)).toBe(2)
    expect(stepsAffordable(4_999, C)).toBe(4)
  })

  it('crosses a round boundary cleanly', () => {
    expect(stepsAffordable(5_000, C)).toBe(5)
    expect(stepsAffordable(5_499, C)).toBe(5)
    expect(stepsAffordable(5_500, C)).toBe(6)
  })

  it('handles the projected 5th-anniversary paid balance', () => {
    // ~21,700 paid carats by the 5th anniversary: four full ladders plus two
    // steps into a fifth, i.e. affordability really does bind before the
    // 25,000 that running all five banners would need.
    expect(stepsAffordable(21_700, C)).toBe(22)
    expect(stepsAffordable(25_000, C)).toBe(25)
  })

  it('returns 0 for junk input rather than propagating it', () => {
    // NaN compares false against everything, so a `<= 0` guard would let it
    // through and poison the odds downstream.
    expect(stepsAffordable(-1, C)).toBe(0)
    expect(stepsAffordable(NaN, C)).toBe(0)
  })

  it('round-trips against cumulativeStepCost at every step count', () => {
    for (let n = 0; n <= 40; n++) {
      expect(stepsAffordable(cumulativeStepCost(n, C), C)).toBe(n)
    }
  })

  it('never claims a step the carats cannot pay for', () => {
    for (let paid = 0; paid <= 12_000; paid += 137) {
      expect(cumulativeStepCost(stepsAffordable(paid, C), C)).toBeLessThanOrEqual(
        paid
      )
    }
  })
})

// ── stepLabel ─────────────────────────────────────────────────────────────────

describe('stepLabel', () => {
  it('writes a partial first round as a bare number', () => {
    expect(stepLabel(1)).toBe('1')
    expect(stepLabel(3)).toBe('3')
    expect(stepLabel(4)).toBe('4')
  })

  it('writes completed rounds as 5xN', () => {
    expect(stepLabel(5)).toBe('5x1')
    expect(stepLabel(10)).toBe('5x2')
    expect(stepLabel(15)).toBe('5x3')
    expect(stepLabel(35)).toBe('5x7')
  })

  it('writes a remainder after completed rounds as 5xN-r', () => {
    expect(stepLabel(6)).toBe('5x1-1')
    expect(stepLabel(7)).toBe('5x1-2')
    expect(stepLabel(14)).toBe('5x2-4')
  })

  it('spells zero as 0, not 5x0', () => {
    expect(stepLabel(0)).toBe('0')
  })
})

// ── guaranteedCopies ──────────────────────────────────────────────────────────

describe('guaranteedCopies', () => {
  it('grants one copy per completed round and nothing part-way', () => {
    expect(guaranteedCopies(0)).toBe(0)
    expect(guaranteedCopies(4)).toBe(0)
    expect(guaranteedCopies(5)).toBe(1)
    expect(guaranteedCopies(9)).toBe(1)
    expect(guaranteedCopies(10)).toBe(2)
    expect(guaranteedCopies(15)).toBe(3)
  })

  it('keeps counting past MLB — the clamp belongs to the odds, not here', () => {
    expect(guaranteedCopies(35)).toBe(7)
  })
})

// ── the step-up odds path through copyDistribution ────────────────────────────

describe('stepUpCopyDistribution', () => {
  const stepUpOdds = (steps: number) => stepUpCopyDistribution(steps, C)

  it('runs at the 0.3% target rate, not the 0.75% featured rate', () => {
    // One step, no guarantee yet: a plain binomial over 10 pulls.
    const [zeroCopies] = stepUpOdds(1)
    expect(zeroCopies).toBeCloseTo(Math.pow(1 - 0.003, 10) * 100, 9)
    expect(C.step_up_target_rate).toBe(0.003)
  })

  it('sums to 100 and floors out below the guarantee', () => {
    const odds = stepUpOdds(15)
    expect(odds).toHaveLength(6)
    expect(odds.reduce((sum, p) => sum + p, 0)).toBeCloseTo(100, 6)
    // Three completed rounds hand over three copies, so 0/1/2 are unreachable.
    expect(odds.slice(0, 3)).toEqual([0, 0, 0])
    expect(odds[3]).toBeGreaterThan(0)
  })

  it('reads one step as ten pulls, not as one', () => {
    // The bug this helper exists to prevent: a step-up row's input is STEPS, so
    // feeding it to the standard binomial would understate a plan tenfold.
    const oneStep = stepUpOdds(1)[0]
    const tenPulls = Math.pow(1 - C.step_up_target_rate, 10) * 100
    const onePull = Math.pow(1 - C.step_up_target_rate, 1) * 100
    expect(oneStep).toBeCloseTo(tenPulls, 9)
    expect(oneStep).not.toBeCloseTo(onePull, 4)
  })

  it('clamps guarantees past MLB into a certainty', () => {
    // Seven rounds guarantee seven copies; there is no 5LB, so the top bucket
    // takes everything rather than the distribution collapsing to all zeroes.
    const odds = stepUpOdds(35)
    expect(odds).toEqual([0, 0, 0, 0, 0, 100])
  })
})
