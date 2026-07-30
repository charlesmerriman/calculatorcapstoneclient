import { describe, it, expect } from 'vitest'
import { applyPullStrategy, getPullCountStatus } from '../utils/bannerHelpers'
import type { PullStrategyInput } from '../utils/bannerHelpers'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** A neutral strategy input: no resources, default toggles (full price on). */
const baseInput: PullStrategyInput = {
  isUmaBanner: true,
  plannedPulls: 0,
  freePulls: 0,
  umaTickets: 0,
  supportTickets: 0,
  freeCarats: 0,
  paidCarats: 0,
  discountDays: 0,
  discountedPaidPulls: false,
  fullPricePaidPulls: true,
}

function strat(overrides: Partial<PullStrategyInput>) {
  return applyPullStrategy({ ...baseInput, ...overrides })
}

// ── maxPossiblePulls ──────────────────────────────────────────────────────────

describe('applyPullStrategy — maxPossiblePulls', () => {
  it('sums free pulls, matching tickets, and floor(carats / 150)', () => {
    const { maxPossiblePulls } = strat({ freePulls: 3, umaTickets: 2, freeCarats: 1_000 })
    expect(maxPossiblePulls).toBe(3 + 2 + 6) // floor(1000 / 150) = 6
  })

  it('floors fractional carat-pulls (does not round up)', () => {
    expect(strat({ freeCarats: 149 }).maxPossiblePulls).toBe(0)
  })

  it('clamps to 0 when carats are negative (earlier banners overspent)', () => {
    expect(strat({ freeCarats: -5_000 }).maxPossiblePulls).toBe(0)
  })

  it('a small ticket/free count cannot rescue a large negative carat balance', () => {
    // 1 + 1 + floor(-5000 / 150) = 1 + 1 - 34 = -32 → clamped to 0
    expect(strat({ freePulls: 1, umaTickets: 1, freeCarats: -5_000 }).maxPossiblePulls).toBe(0)
  })

  it('combines free + paid remainders at full price (fungible carats)', () => {
    // 100 free + 100 paid = 200 → one full-price pull, not zero.
    expect(strat({ freeCarats: 100, paidCarats: 100 }).maxPossiblePulls).toBe(1)
  })

  it('excludes paid carats from the max when full_price_paid_pulls is off', () => {
    expect(
      strat({ freeCarats: 100, paidCarats: 1_000, fullPricePaidPulls: false }).maxPossiblePulls
    ).toBe(0) // floor(100 / 150) = 0; the 1000 paid is reserved
  })

  it('adds discounted pulls (capped by paid balance) to the max', () => {
    // 100 paid = 2 discounted pulls; full price off isolates the discount.
    expect(
      strat({
        paidCarats: 100,
        discountDays: 10,
        discountedPaidPulls: true,
        fullPricePaidPulls: false,
      }).maxPossiblePulls
    ).toBe(2)
  })

  it('caps discounted pulls at discountDays, spilling leftover paid to full price', () => {
    // Day cap 1 → 1 discounted pull (50 spent); remaining 950 paid at full price
    // = floor(950 / 150) = 6. Total 7.
    expect(
      strat({
        paidCarats: 1_000,
        discountDays: 1,
        discountedPaidPulls: true,
        fullPricePaidPulls: true,
      }).maxPossiblePulls
    ).toBe(1 + 6)
  })
})

// ── Actual spend (leftover balances) ────────────────────────────────────────────

describe('applyPullStrategy — spend', () => {
  it('spends matching tickets before carats', () => {
    const r = strat({ plannedPulls: 5, umaTickets: 2, freeCarats: 1_000 })
    expect(r.umaTickets).toBe(0)
    expect(r.freeCarats).toBe(1_000 - 3 * 150) // 3 remaining pulls at 150
    expect(r.paidCarats).toBe(0)
  })

  it('uses support tickets (not uma) for a support banner', () => {
    const r = strat({ isUmaBanner: false, plannedPulls: 3, supportTickets: 1, freeCarats: 1_000 })
    expect(r.supportTickets).toBe(0)
    expect(r.freeCarats).toBe(1_000 - 2 * 150)
  })

  it('spends paid carats at the discount rate (50) when enabled', () => {
    const r = strat({
      plannedPulls: 3,
      paidCarats: 500,
      discountDays: 10,
      discountedPaidPulls: true,
    })
    expect(r.paidCarats).toBe(500 - 3 * 50) // 3 discounted pulls
    expect(r.freeCarats).toBe(0)
  })

  it('spends free carats before paid carats (preserving paid for discounts)', () => {
    const r = strat({ plannedPulls: 1, freeCarats: 200, paidCarats: 200 })
    expect(r.freeCarats).toBe(200 - 150)
    expect(r.paidCarats).toBe(200) // untouched — free covered the pull
  })

  it('reserves paid carats when full_price_paid_pulls is off (deficit on free)', () => {
    const r = strat({ plannedPulls: 2, freeCarats: 100, paidCarats: 1_000, fullPricePaidPulls: false })
    expect(r.paidCarats).toBe(1_000) // reserved, never spent
    expect(r.freeCarats).toBe(100 - 2 * 150) // -200: the shortfall shows as a deficit
  })

  it('falls through discount → free → full-price paid in order', () => {
    // 3 pulls: 1 discounted (day cap 1, 50 paid), then 0 free, then 2 at full
    // price paid from the remaining paid carats.
    const r = strat({
      plannedPulls: 3,
      freeCarats: 0,
      paidCarats: 500,
      discountDays: 1,
      discountedPaidPulls: true,
      fullPricePaidPulls: true,
    })
    // 1 discount (50) + 2 full price (300) = 350 paid spent.
    expect(r.paidCarats).toBe(500 - 350)
    expect(r.freeCarats).toBe(0)
  })
})

// ── getPullCountStatus ────────────────────────────────────────────────────────

describe('getPullCountStatus', () => {
  it('flags a count above the affordable max as "over"', () => {
    expect(getPullCountStatus(31, 30)).toBe('over')
  })

  it('treats exactly the max as affordable, not over', () => {
    expect(getPullCountStatus(30, 30)).toBe('neutral')
  })

  it('returns "ok" on a pity threshold', () => {
    expect(getPullCountStatus(200, 1_000)).toBe('ok')
    expect(getPullCountStatus(400, 1_000)).toBe('ok')
  })

  it('returns "neutral" one pull either side of a threshold', () => {
    expect(getPullCountStatus(199, 1_000)).toBe('neutral')
    expect(getPullCountStatus(201, 1_000)).toBe('neutral')
  })

  it('keeps 0 neutral even though it divides evenly', () => {
    // Every untouched row sits at 0; greening them would drain the signal.
    expect(getPullCountStatus(0, 1_000)).toBe('neutral')
  })

  it('prefers "over" when a count is both on-pity and unaffordable', () => {
    expect(getPullCountStatus(400, 300)).toBe('over')
  })

  it('never reports "over" when the bound is Infinity (staged banner)', () => {
    expect(getPullCountStatus(9_999, Infinity)).toBe('neutral')
    expect(getPullCountStatus(200, Infinity)).toBe('ok')
  })

  it('flags any pulls on an ended banner, whose bound is 0', () => {
    expect(getPullCountStatus(1, 0)).toBe('over')
    expect(getPullCountStatus(0, 0)).toBe('neutral')
  })
})
