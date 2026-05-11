// @vitest-environment node
// Pure math functions — no DOM APIs needed, so we skip jsdom for faster teardown.
import {
  calculateSuccessProbability,
  calculateZeroProbability,
} from '../utils/probabilityCalculations'

// ── calculateSuccessProbability ───────────────────────────────────────────────

describe('calculateSuccessProbability', () => {
  describe('boundary conditions', () => {
    it('returns 0 with 0 pulls (no chance of success)', () => {
      // getExactProbability(0, 0) = 0.9925^0 = 1 → failProb = 1 → (1-1)*100 = 0
      expect(calculateSuccessProbability(0, 1)).toBe(0)
    })

    it('returns 100 with exactly 1000 pulls regardless of copies needed', () => {
      expect(calculateSuccessProbability(1000, 1)).toBe(100)
      expect(calculateSuccessProbability(1000, 99)).toBe(100)
    })

    it('returns 100 with more than 1000 pulls', () => {
      expect(calculateSuccessProbability(1500, 5)).toBe(100)
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
    // Each threshold reduces successNeeded by N.
    // When the adjusted value hits 0 or below, the function returns 100
    // (pity guarantees success). One more copy needed keeps it below 100.

    it('at 200 pulls: needing 1 copy is guaranteed (pity reduces 1 → 0)', () => {
      expect(calculateSuccessProbability(200, 1)).toBe(100)
    })

    it('at 200 pulls: needing 2 copies is not yet guaranteed (reduces to 1)', () => {
      expect(calculateSuccessProbability(200, 2)).toBeLessThan(100)
    })

    it('at 199 pulls: needing 1 copy is not guaranteed (just below threshold)', () => {
      expect(calculateSuccessProbability(199, 1)).toBeLessThan(100)
    })

    it('at 400 pulls: needing 2 copies is guaranteed (pity reduces 2 → 0)', () => {
      expect(calculateSuccessProbability(400, 2)).toBe(100)
    })

    it('at 400 pulls: needing 3 copies is not yet guaranteed (reduces to 1)', () => {
      expect(calculateSuccessProbability(400, 3)).toBeLessThan(100)
    })

    it('at 600 pulls: needing 3 copies is guaranteed (pity reduces 3 → 0)', () => {
      expect(calculateSuccessProbability(600, 3)).toBe(100)
    })

    it('at 600 pulls: needing 4 copies is not yet guaranteed (reduces to 1)', () => {
      expect(calculateSuccessProbability(600, 4)).toBeLessThan(100)
    })

    it('at 800 pulls: needing 4 copies is guaranteed (pity reduces 4 → 0)', () => {
      expect(calculateSuccessProbability(800, 4)).toBe(100)
    })

    it('at 800 pulls: needing 5 copies is not yet guaranteed (reduces to 1)', () => {
      expect(calculateSuccessProbability(800, 5)).toBeLessThan(100)
    })

    it('returns 100 when pity reduces successNeeded below zero', () => {
      // 800 pulls reduces by 4; needing 2 copies → adjusted = -2 ≤ 0 → 100
      expect(calculateSuccessProbability(800, 2)).toBe(100)
    })
  })
})

// ── calculateZeroProbability ──────────────────────────────────────────────────

describe('calculateZeroProbability', () => {
  it('returns 100 with 0 pulls (zero-copy outcome is certain)', () => {
    // calculateSuccessProbability(0, 1) = 0, so Math.abs(0 - 100) = 100
    expect(calculateZeroProbability(0)).toBe(100)
  })

  it('returns 0 with 1000+ pulls (guaranteed at least one copy)', () => {
    expect(calculateZeroProbability(1000)).toBe(0)
  })

  it('is the exact complement of calculateSuccessProbability(n, 1)', () => {
    // By definition: zero-copy% + at-least-one% = 100
    const pulls = 100
    expect(calculateSuccessProbability(pulls, 1) + calculateZeroProbability(pulls)).toBe(100)
  })

  it('decreases as more pulls are made', () => {
    const at50  = calculateZeroProbability(50)
    const at100 = calculateZeroProbability(100)
    expect(at50).toBeGreaterThan(at100)
  })

  it('returns 0 when pity already guarantees at least one copy', () => {
    // At 200 pulls, pity guarantees 1 copy → zero-copy probability is 0
    expect(calculateZeroProbability(200)).toBe(0)
  })
})
