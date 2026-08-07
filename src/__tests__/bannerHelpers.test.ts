import { describe, it, expect } from 'vitest'
import {
  allocateReservedCopies,
  applyPullStrategy,
  bannerKey,
  getPullCountStatus,
  getReservedStatus,
  nextTempId,
  plannedBannerKey,
} from '../utils/bannerHelpers'
import type { PullStrategyInput } from '../utils/bannerHelpers'
import type { SelectorTicketBucket } from '../utils/selectorTickets'
import type { BannerSupport, BannerUma, UserPlannedBanner } from '../types'

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

// ── maxPullBreakdown ──────────────────────────────────────────────────────────

describe('applyPullStrategy — maxPullBreakdown', () => {
  it('decomposes the max without changing it', () => {
    const { maxPossiblePulls, maxPullBreakdown: b } = strat({
      freePulls: 3,
      umaTickets: 2,
      freeCarats: 1_000,
    })
    expect(b).toEqual({ freePulls: 3, tickets: 2, paidPulls: 0, freeCaratPulls: 6 })
    expect(b.freePulls + b.tickets + b.paidPulls + b.freeCaratPulls).toBe(maxPossiblePulls)
  })

  it('reports the matching ticket type only (no cross-substitution)', () => {
    expect(strat({ umaTickets: 5, supportTickets: 9 }).maxPullBreakdown.tickets).toBe(5)
    expect(
      strat({ isUmaBanner: false, umaTickets: 5, supportTickets: 9 }).maxPullBreakdown.tickets
    ).toBe(9)
  })

  it('attributes a full-price pull that only exists thanks to paid carats to paid', () => {
    // 100 free alone buys nothing; +500 paid makes 4 pulls. All 4 are marginal.
    const b = strat({ freeCarats: 100, paidCarats: 500 }).maxPullBreakdown
    expect(b).toMatchObject({ paidPulls: 4, freeCaratPulls: 0 })
  })

  it('puts the shared boundary pull in the paid bucket, not the free one', () => {
    // 200 free + 100 paid = 2 pulls. Free alone affords 1, so the second pull —
    // paid for by a free remainder plus paid carats — counts as paid.
    const b = strat({ freeCarats: 200, paidCarats: 100 }).maxPullBreakdown
    expect(b).toMatchObject({ paidPulls: 1, freeCaratPulls: 1 })
  })

  it('counts discounted pulls as paid', () => {
    const b = strat({
      paidCarats: 500,
      discountDays: 10,
      discountedPaidPulls: true,
    }).maxPullBreakdown
    expect(b).toMatchObject({ paidPulls: 10, freeCaratPulls: 0 })
  })

  it('reports 0 paid pulls when both paid-pull settings are off', () => {
    const b = strat({
      freeCarats: 900,
      paidCarats: 500,
      discountedPaidPulls: false,
      fullPricePaidPulls: false,
    }).maxPullBreakdown
    expect(b).toMatchObject({ paidPulls: 0, freeCaratPulls: 6 })
  })

  it('clamps each part at 0 under a carat deficit, so the parts can exceed the total', () => {
    // The total clamps to 0, but the free pulls and tickets really are still
    // available — the deficit is a carat debt, not a lost ticket.
    const { maxPossiblePulls, maxPullBreakdown: b } = strat({
      freePulls: 5,
      umaTickets: 3,
      freeCarats: -5_000,
    })
    expect(maxPossiblePulls).toBe(0)
    expect(b).toEqual({ freePulls: 5, tickets: 3, paidPulls: 0, freeCaratPulls: 0 })
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

// ── bannerKey / plannedBannerKey ──────────────────────────────────────────────

describe('bannerKey / plannedBannerKey', () => {
  // The seed data populates BannerUma and BannerSupport in lockstep, so an uma
  // banner and a support banner sharing an id usually also share a
  // BannerTimeline — and therefore a date. These two stand in for that pairing.
  const timeline = {
    id: 1,
    name: 'Shared Window',
    start_date: '2099-01-01T22:00:00Z',
    end_date: '2099-02-01T21:59:59Z',
    is_predicted: false,
    jp_start_date: null,
    jp_end_date: null,
    global_start_date: '2099-01-01T22:00:00Z',
    global_end_date: '2099-02-01T21:59:59Z',
    image: '',
  }

  const umaBanner: BannerUma = {
    id: 1,
    banner_timeline: timeline,
    name: 'Uma Banner',
    admin_comments: '',
    umas: [],
    free_pulls: 0,
  }

  const supportBanner: BannerSupport = {
    id: 1,
    banner_timeline: timeline,
    name: 'Support Banner',
    admin_comments: '',
    support_cards: [],
    free_pulls: 0,
  }

  it('never collides an uma banner with a support banner of the same id', () => {
    // The whole reason this key exists. BannerUma and BannerSupport are separate
    // tables with independent autoincrement PKs, so id alone is ambiguous.
    expect(bannerKey('Uma', 1)).not.toBe(bannerKey('Support', 1))
  })

  it('is stable for the same type and id', () => {
    expect(bannerKey('Uma', 7)).toBe(bannerKey('Uma', 7))
    expect(bannerKey('Support', 7)).toBe(bannerKey('Support', 7))
  })

  it('distinguishes different ids within a type', () => {
    expect(bannerKey('Uma', 1)).not.toBe(bannerKey('Uma', 2))
  })

  it('keys a planned row by whichever banner it holds', () => {
    expect(plannedBannerKey({ banner_uma: umaBanner })).toBe(bannerKey('Uma', 1))
    expect(plannedBannerKey({ banner_support: supportBanner })).toBe(
      bannerKey('Support', 1)
    )
  })

  it('gives same-date uma and support rows distinct keys', () => {
    // The regression: planning the uma banner must not mark the support banner
    // from the same window as already planned.
    const planned = [{ banner_uma: umaBanner }, { banner_support: supportBanner }]
    const keys = new Set(planned.map(plannedBannerKey))
    expect(keys.size).toBe(2)
  })

  it('still catches a genuine same-type duplicate', () => {
    expect(plannedBannerKey({ banner_uma: umaBanner })).toBe(
      plannedBannerKey({ banner_uma: { ...umaBanner } })
    )
  })

  it('returns null for a row with no banner selected yet', () => {
    expect(plannedBannerKey({})).toBeNull()
  })
})

// ── allocateReservedCopies ────────────────────────────────────────────────────

describe('allocateReservedCopies', () => {
  const OLD = '2020-01-01T00:00:00Z'
  const NEW = '2030-01-01T00:00:00Z'

  const base = {
    reservedCopies: 0,
    isUmaBanner: false,
    oldestFeaturedJpDate: OLD as string | null,
    umaSelectorTickets: [] as SelectorTicketBucket[],
    supportSelectorTickets: [] as SelectorTicketBucket[],
    ssrCrystals: 0,
  }

  it('spends nothing for a zero reserve', () => {
    const result = allocateReservedCopies({ ...base, ssrCrystals: 5 })
    expect(result.funding).toEqual({ selectors: 0, crystals: 0, unfunded: 0 })
    expect(result.ssrCrystals).toBe(5)
  })

  it('spends selectors before crystals', () => {
    const result = allocateReservedCopies({
      ...base,
      reservedCopies: 2,
      supportSelectorTickets: [{ jpCutoff: null, count: 3 }],
      ssrCrystals: 5,
    })
    expect(result.funding).toEqual({ selectors: 2, crystals: 0, unfunded: 0 })
    expect(result.ssrCrystals).toBe(5)
  })

  it('falls back to crystals when the selector cannot reach the card', () => {
    const result = allocateReservedCopies({
      ...base,
      reservedCopies: 2,
      oldestFeaturedJpDate: NEW,
      supportSelectorTickets: [{ jpCutoff: '2024-01-31', count: 3 }],
      ssrCrystals: 5,
    })
    expect(result.funding).toEqual({ selectors: 0, crystals: 2, unfunded: 0 })
    expect(result.ssrCrystals).toBe(3)
    // The unusable selectors are untouched.
    expect(result.supportSelectorTickets).toEqual([
      { jpCutoff: '2024-01-31', count: 3 },
    ])
  })

  it('splits across selectors then crystals', () => {
    const result = allocateReservedCopies({
      ...base,
      reservedCopies: 3,
      supportSelectorTickets: [{ jpCutoff: null, count: 1 }],
      ssrCrystals: 5,
    })
    expect(result.funding).toEqual({ selectors: 1, crystals: 2, unfunded: 0 })
  })

  it('never spends crystals on an uma banner', () => {
    const result = allocateReservedCopies({
      ...base,
      isUmaBanner: true,
      reservedCopies: 2,
      ssrCrystals: 9,
    })
    expect(result.funding).toEqual({ selectors: 0, crystals: 0, unfunded: 2 })
    expect(result.ssrCrystals).toBe(9)
  })

  it('uses the uma pool on an uma banner', () => {
    const result = allocateReservedCopies({
      ...base,
      isUmaBanner: true,
      reservedCopies: 1,
      umaSelectorTickets: [{ jpCutoff: null, count: 2 }],
      supportSelectorTickets: [{ jpCutoff: null, count: 2 }],
    })
    expect(result.funding.selectors).toBe(1)
    expect(result.umaSelectorTickets).toEqual([{ jpCutoff: null, count: 1 }])
    expect(result.supportSelectorTickets).toEqual([{ jpCutoff: null, count: 2 }])
  })

  it('reports the shortfall rather than clamping', () => {
    const result = allocateReservedCopies({
      ...base,
      reservedCopies: 4,
      ssrCrystals: 1,
    })
    expect(result.funding).toEqual({ selectors: 0, crystals: 1, unfunded: 3 })
  })

  it('treats an unknown featured date as unreachable by a cutoff selector', () => {
    const result = allocateReservedCopies({
      ...base,
      reservedCopies: 1,
      oldestFeaturedJpDate: null,
      supportSelectorTickets: [{ jpCutoff: '2024-01-31', count: 2 }],
    })
    expect(result.funding).toEqual({ selectors: 0, crystals: 0, unfunded: 1 })
  })

  it('floors a fractional reserve and ignores a negative one', () => {
    expect(
      allocateReservedCopies({ ...base, reservedCopies: 2.9, ssrCrystals: 5 })
        .funding.crystals
    ).toBe(2)
    expect(
      allocateReservedCopies({ ...base, reservedCopies: -1, ssrCrystals: 5 })
        .funding
    ).toEqual({ selectors: 0, crystals: 0, unfunded: 0 })
  })
})

describe('getReservedStatus', () => {
  it('flags an unfunded request', () => {
    expect(getReservedStatus({ selectors: 1, crystals: 0, unfunded: 2 })).toBe('over')
  })

  it('is ok when everything is covered', () => {
    expect(getReservedStatus({ selectors: 0, crystals: 3, unfunded: 0 })).toBe('ok')
  })

  it('is neutral when nothing is reserved', () => {
    expect(getReservedStatus({ selectors: 0, crystals: 0, unfunded: 0 })).toBe('neutral')
  })
})

describe('nextTempId', () => {
  it('clears every id in play, staged and on the sheet alike', () => {
    const sheet = [{ id: 7, number_of_pulls: 0, reserved_copies: 0 }]
    const staged = [{ tempId: 12, number_of_pulls: 0, reserved_copies: 0 }]
    expect(nextTempId(sheet, staged)).toBe(13)
  })

  it('prefers tempId over a stale server id on the same row', () => {
    const sheet = [{ id: 3, tempId: 40, number_of_pulls: 0, reserved_copies: 0 }]
    expect(nextTempId(sheet)).toBe(41)
  })

  it('starts at 1 when nothing exists yet', () => {
    expect(nextTempId([], [])).toBe(1)
  })

  // The reason this takes `prev` from inside a setState updater: staging two
  // banners back to back must never mint the same id twice, since every staged
  // handler selects its row by tempId.
  it('keeps issuing distinct ids as rows accumulate', () => {
    let staged: UserPlannedBanner[] = []
    const sheet: UserPlannedBanner[] = [{ id: 2, number_of_pulls: 0, reserved_copies: 0 }]

    for (let i = 0; i < 3; i++) {
      staged = [...staged, { tempId: nextTempId(sheet, staged), number_of_pulls: 0, reserved_copies: 0 }]
    }

    expect(staged.map((b) => b.tempId)).toEqual([3, 4, 5])
  })
})
