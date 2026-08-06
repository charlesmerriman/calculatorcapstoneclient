// @vitest-environment node
// Pure math functions — no DOM APIs needed, so we skip jsdom for faster teardown.
import {
  MAX_COPIES,
  calculateCopyDistribution,
  calculateSuccessProbability,
  getGuaranteedCopies,
  shiftDistribution,
} from '../utils/probabilityCalculations'

// ── getGuaranteedCopies ───────────────────────────────────────────────────────

describe('getGuaranteedCopies', () => {
  it('grants no copies below the first pity threshold', () => {
    expect(getGuaranteedCopies(0)).toBe(0)
    expect(getGuaranteedCopies(199)).toBe(0)
  })

  it('grants one copy per 200 pulls', () => {
    expect(getGuaranteedCopies(200)).toBe(1)
    expect(getGuaranteedCopies(400)).toBe(2)
    expect(getGuaranteedCopies(600)).toBe(3)
    expect(getGuaranteedCopies(800)).toBe(4)
    expect(getGuaranteedCopies(1000)).toBe(5)
  })

  it('caps at MLB — further exchanges have nothing left to break', () => {
    expect(getGuaranteedCopies(1500)).toBe(MAX_COPIES)
    expect(getGuaranteedCopies(99999)).toBe(MAX_COPIES)
  })
})

// ── calculateCopyDistribution ─────────────────────────────────────────────────

describe('calculateCopyDistribution', () => {
  it('returns one entry per outcome from zero copies through MLB', () => {
    expect(calculateCopyDistribution(100)).toHaveLength(MAX_COPIES + 1)
  })

  describe('is a true discrete distribution', () => {
    // The whole point of the change: cells are mutually exclusive outcomes,
    // not "this or better", so they must total 100%.
    it.each([0, 50, 100, 150, 250, 500, 799, 1000, 2000])(
      'sums to 100%% at %i pulls',
      (pulls) => {
        const total = calculateCopyDistribution(pulls).reduce((a, b) => a + b, 0)
        expect(total).toBeCloseTo(100, 6)
      }
    )

    it('reports strictly lower odds than the cumulative equivalent', () => {
      // At 100 pulls, "exactly 1 copy" must come in under "1 or more copies" —
      // the gap is every player who went on to pull 2, 3, 4 or 5.
      const exactlyOne = calculateCopyDistribution(100)[1]
      const oneOrMore = calculateSuccessProbability(100, 1)
      expect(exactlyOne).toBeLessThan(oneOrMore)
      expect(exactlyOne).toBeCloseTo(35.59, 1)
      expect(oneOrMore).toBeCloseTo(52.9, 1)
    })

    it('is not forced to decrease left to right, unlike a cumulative row', () => {
      // 250 pulls peaks in the middle (at 2 copies). A cumulative row could
      // never render this shape, which is what made the old display useless.
      const distribution = calculateCopyDistribution(250)
      expect(distribution[2]).toBeGreaterThan(distribution[1])
      expect(distribution[2]).toBeGreaterThan(distribution[3])
    })
  })

  describe('boundary conditions', () => {
    it('puts all weight on zero copies when no pulls are made', () => {
      expect(calculateCopyDistribution(0)).toEqual([100, 0, 0, 0, 0, 0])
    })

    it('puts all weight on MLB once pity alone maxes the card', () => {
      expect(calculateCopyDistribution(1000)).toEqual([0, 0, 0, 0, 0, 100])
    })

    it('never returns a negative percentage', () => {
      for (const pulls of [0, 1, 100, 250, 999, 1000, 5000]) {
        for (const value of calculateCopyDistribution(pulls)) {
          expect(value).toBeGreaterThanOrEqual(0)
        }
      }
    })
  })

  describe('pity floor', () => {
    it('zeroes out totals that pity makes unreachable', () => {
      // 250 pulls guarantee 1 copy, so finishing with none is impossible.
      const distribution = calculateCopyDistribution(250)
      expect(distribution[0]).toBe(0)
      expect(distribution[1]).toBeGreaterThan(0)
    })

    it('walks the floor up as pity thresholds are crossed', () => {
      expect(calculateCopyDistribution(600)[2]).toBe(0)
      expect(calculateCopyDistribution(600)[3]).toBeGreaterThan(0)
    })

    it('leaves every outcome reachable below the first threshold', () => {
      expect(calculateCopyDistribution(199)[0]).toBeGreaterThan(0)
    })
  })

  describe('the MLB bucket stays cumulative', () => {
    it('absorbs surplus copies past MLB', () => {
      // There is no 5LB — the top cell has to catch 6, 7, 8+ copies too, or
      // the row would total under 100%.
      expect(calculateCopyDistribution(150)[MAX_COPIES]).toBe(
        calculateSuccessProbability(150, MAX_COPIES)
      )
    })
  })
})

// ── calculateSuccessProbability ───────────────────────────────────────────────

describe('calculateSuccessProbability', () => {
  describe('boundary conditions', () => {
    it('returns 0 with 0 pulls (no chance of success)', () => {
      expect(calculateSuccessProbability(0, 1)).toBe(0)
    })

    it('returns 100 with exactly 1000 pulls, where pity alone reaches MLB', () => {
      expect(calculateSuccessProbability(1000, 1)).toBe(100)
      expect(calculateSuccessProbability(1000, MAX_COPIES)).toBe(100)
    })

    it('returns 100 with more than 1000 pulls', () => {
      expect(calculateSuccessProbability(1500, 5)).toBe(100)
    })

    it('does not treat pity as unlimited past MLB', () => {
      // Pity caps at 5 copies, so asking for more is no longer a free 100%.
      expect(calculateSuccessProbability(1000, 99)).toBeLessThan(100)
    })

    it('is monotonically increasing with pull count', () => {
      const at50  = calculateSuccessProbability(50, 1)
      const at100 = calculateSuccessProbability(100, 1)
      const at150 = calculateSuccessProbability(150, 1)
      expect(at50).toBeLessThan(at100)
      expect(at100).toBeLessThan(at150)
    })

    it('returns a value between 0 and 100 for typical inputs', () => {
      const p = calculateSuccessProbability(100, 1)
      expect(p).toBeGreaterThan(0)
      expect(p).toBeLessThan(100)
    })
  })

  describe('pity thresholds', () => {
    // Each threshold hands over one more guaranteed copy. Once pity covers the
    // whole request the result is certain; one copy more keeps it below 100.

    it('at 200 pulls: needing 1 copy is guaranteed', () => {
      expect(calculateSuccessProbability(200, 1)).toBe(100)
    })

    it('at 200 pulls: needing 2 copies is not yet guaranteed', () => {
      expect(calculateSuccessProbability(200, 2)).toBeLessThan(100)
    })

    it('at 199 pulls: needing 1 copy is not guaranteed (just below threshold)', () => {
      expect(calculateSuccessProbability(199, 1)).toBeLessThan(100)
    })

    it('at 400 pulls: needing 2 copies is guaranteed', () => {
      expect(calculateSuccessProbability(400, 2)).toBe(100)
    })

    it('at 400 pulls: needing 3 copies is not yet guaranteed', () => {
      expect(calculateSuccessProbability(400, 3)).toBeLessThan(100)
    })

    it('at 600 pulls: needing 3 copies is guaranteed', () => {
      expect(calculateSuccessProbability(600, 3)).toBe(100)
    })

    it('at 600 pulls: needing 4 copies is not yet guaranteed', () => {
      expect(calculateSuccessProbability(600, 4)).toBeLessThan(100)
    })

    it('at 800 pulls: needing 4 copies is guaranteed', () => {
      expect(calculateSuccessProbability(800, 4)).toBe(100)
    })

    it('at 800 pulls: needing 5 copies is not yet guaranteed', () => {
      expect(calculateSuccessProbability(800, 5)).toBeLessThan(100)
    })

    it('returns 100 when pity overshoots the requested copies', () => {
      // 800 pulls grant 4 copies; only 2 were asked for.
      expect(calculateSuccessProbability(800, 2)).toBe(100)
    })
  })
})

describe('shiftDistribution', () => {
  it('is a no-op for zero reserved copies', () => {
    const base = calculateCopyDistribution(100)
    expect(shiftDistribution(base, 0)).toBe(base)
  })

  it('moves each outcome up by the reserved count', () => {
    const base = calculateCopyDistribution(100)
    const shifted = shiftDistribution(base, 2)

    // Ending with 0 or 1 copies is now impossible — two are already in hand.
    expect(shifted[0]).toBe(0)
    expect(shifted[1]).toBe(0)
    // "Exactly 2 total" is now "pulls produced 0".
    expect(shifted[2]).toBeCloseTo(base[0], 10)
    expect(shifted[3]).toBeCloseTo(base[1], 10)
  })

  it('folds the tail into the MLB bucket', () => {
    const base = calculateCopyDistribution(100)
    const shifted = shiftDistribution(base, 2)
    const tail = base.slice(3).reduce((sum, p) => sum + p, 0)

    expect(shifted[MAX_COPIES]).toBeCloseTo(tail, 10)
  })

  it('still sums to 100', () => {
    for (const reserved of [0, 1, 3, 5]) {
      const shifted = shiftDistribution(calculateCopyDistribution(250), reserved)
      const total = shifted.reduce((sum, p) => sum + p, 0)
      expect(total).toBeCloseTo(100, 6)
    }
  })

  it('is a certainty at MLB once enough copies are reserved', () => {
    const shifted = shiftDistribution(calculateCopyDistribution(0), MAX_COPIES)
    expect(shifted[MAX_COPIES]).toBeCloseTo(100, 6)
  })

  it('clamps a negative or fractional reserve rather than producing holes', () => {
    const base = calculateCopyDistribution(100)
    expect(shiftDistribution(base, -3)).toBe(base)
    expect(shiftDistribution(base, 1.7)).toEqual(shiftDistribution(base, 1))
  })
})
