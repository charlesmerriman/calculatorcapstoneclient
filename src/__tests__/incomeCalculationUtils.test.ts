import { describe, it, expect } from 'vitest'
import { getTrainingPassIncome, calculateDayOfMonthOccurrences, calculateMonthlyOccurrences, calculateAnnualDateOccurrences } from '../utils/incomeCalculationUtils'
import {
  TRAINING_PASS_START_DATE,
  TRAINING_PASS_REWARD_DAY,
  TRAINING_PASS_MONTHLY_REWARD,
  TRAINING_PASS_MONTHLY_FREE_CARATS,
  TRAINING_PASS_MONTHLY_PAID_CARATS,
  MONTHLY_BASE_REWARD,
} from '../constants/gameConstants'

// A window that opens after the pass launches (Aug 15, 2027) and spans a couple
// of reward days, so the per-month multiplications below have something to
// multiply. Derived from the constants rather than hardcoded so a change to the
// launch date doesn't silently make these tests assert 0 === 0.
const POST_LAUNCH_START = new Date(2027, 7, 20) // Aug 20, 2027
const POST_LAUNCH_END = new Date(2027, 10, 5) // Nov 5, 2027

describe('getTrainingPassIncome', () => {
  describe('paid tier carat split', () => {
    // The paid pass's monthly carats are not one pool: 1,850 arrive as ordinary
    // free carats and 350 as PAID carats (the only balance that can buy the
    // 50-carat discounted pull). The split is what these tests pin down — the
    // total was already covered indirectly by the useBannerResources suite.
    const rewardDays = calculateDayOfMonthOccurrences(
      POST_LAUNCH_START,
      POST_LAUNCH_END,
      TRAINING_PASS_REWARD_DAY
    )

    it('has a window containing at least one payout', () => {
      // Guard: without this, every assertion below would trivially pass on 0.
      expect(rewardDays).toBeGreaterThan(0)
    })

    it('credits the free half to free carats', () => {
      const income = getTrainingPassIncome(POST_LAUNCH_START, POST_LAUNCH_END, true)
      expect(income.freeCarats).toBe(rewardDays * TRAINING_PASS_MONTHLY_FREE_CARATS)
    })

    it('credits the paid half to paid carats', () => {
      const income = getTrainingPassIncome(POST_LAUNCH_START, POST_LAUNCH_END, true)
      expect(income.paidCarats).toBe(rewardDays * TRAINING_PASS_MONTHLY_PAID_CARATS)
    })

    it('splits without changing the monthly total', () => {
      // The headline "+2,200/mo" figure must equal free + paid, or the badge
      // and the projection would disagree.
      const income = getTrainingPassIncome(POST_LAUNCH_START, POST_LAUNCH_END, true)
      expect(income.freeCarats + income.paidCarats).toBe(
        rewardDays * TRAINING_PASS_MONTHLY_REWARD
      )
    })
  })

  describe('free tier', () => {
    it('grants free carats only — no paid carats', () => {
      const income = getTrainingPassIncome(POST_LAUNCH_START, POST_LAUNCH_END, false)
      const months = calculateMonthlyOccurrences(POST_LAUNCH_START, POST_LAUNCH_END)

      expect(months).toBeGreaterThan(0)
      expect(income.freeCarats).toBe(months * MONTHLY_BASE_REWARD)
      expect(income.paidCarats).toBe(0)
    })
  })

  describe('before the feature launches', () => {
    it('grants nothing of either carat kind', () => {
      const end = new Date(TRAINING_PASS_START_DATE.getTime() - 24 * 60 * 60 * 1000)
      const start = new Date(2027, 6, 1)

      const paid = getTrainingPassIncome(start, end, true)
      const free = getTrainingPassIncome(start, end, false)

      expect(paid).toEqual({ freeCarats: 0, paidCarats: 0, umaTickets: 0, supportTickets: 0 })
      expect(free).toEqual({ freeCarats: 0, paidCarats: 0, umaTickets: 0, supportTickets: 0 })
    })
  })
})

describe('calculateAnnualDateOccurrences', () => {
  // February 14, expressed the way the constants do (month is 0-indexed).
  const FEB = 1
  const VDAY = 14

  it('counts a single occurrence when the window spans one February 14', () => {
    const start = new Date(2027, 0, 1)
    const end = new Date(2027, 11, 31)
    expect(calculateAnnualDateOccurrences(start, end, FEB, VDAY)).toBe(1)
  })

  it('counts one occurrence per year over a multi-year window', () => {
    const start = new Date(2027, 0, 1)
    const end = new Date(2030, 0, 1)
    // Feb 14 of 2027, 2028 and 2029 all fall inside; 2030's is after the end.
    expect(calculateAnnualDateOccurrences(start, end, FEB, VDAY)).toBe(3)
  })

  it('returns 0 when the window misses the date entirely', () => {
    const start = new Date(2027, 1, 15)
    const end = new Date(2027, 11, 31)
    expect(calculateAnnualDateOccurrences(start, end, FEB, VDAY)).toBe(0)
  })

  it('excludes the start day and includes the end day (half-open window)', () => {
    // Starting ON Feb 14 must NOT pay out — the start day belongs to the
    // previous banner's window, which already credited it.
    expect(
      calculateAnnualDateOccurrences(new Date(2027, 1, 14), new Date(2027, 1, 20), FEB, VDAY)
    ).toBe(0)

    // Ending ON Feb 14 must pay out.
    expect(
      calculateAnnualDateOccurrences(new Date(2027, 1, 1), new Date(2027, 1, 14), FEB, VDAY)
    ).toBe(1)
  })

  it('tiles across adjacent windows without double-counting the boundary', () => {
    // The property the whole projection depends on: slicing (a,c] into
    // (a,b] ∪ (b,c] must give the same total, including when the split lands
    // exactly on the payout date.
    const a = new Date(2027, 0, 1)
    const b = new Date(2027, 1, 14)
    const c = new Date(2029, 0, 1)

    const whole = calculateAnnualDateOccurrences(a, c, FEB, VDAY)
    const sliced =
      calculateAnnualDateOccurrences(a, b, FEB, VDAY) +
      calculateAnnualDateOccurrences(b, c, FEB, VDAY)

    expect(sliced).toBe(whole)
  })

  it('returns 0 for an empty or backwards window', () => {
    const d = new Date(2027, 5, 1)
    expect(calculateAnnualDateOccurrences(d, d, FEB, VDAY)).toBe(0)
    expect(calculateAnnualDateOccurrences(d, new Date(2027, 0, 1), FEB, VDAY)).toBe(0)
  })
})
