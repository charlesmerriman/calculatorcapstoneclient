// @vitest-environment node
// Pure math functions — no DOM APIs needed, so we skip jsdom for faster teardown.
import { describe, it, expect } from 'vitest'
import type { BannerSupport, BannerUma, SupportCard, Uma } from '../types'
import { DEFAULT_CONSTANTS as C } from '../constants/gameConstants'
import {
  primaryRateUpCard,
  rateUpCards,
  rowRateUpRate,
  type RateUpTarget,
} from '../utils/rateUpRates'

// Only the fields the rule reads; the casts keep the fixtures short.
const uma = (id: number, rarity?: number | null) =>
  ({ id, name: `Uma ${id}`, image: '', rarity }) as Uma
const support = (id: number, rarity?: number | null) =>
  ({ id, name: `Card ${id}`, image: '', rarity }) as SupportCard

const umaTarget = (umas: Uma[], extra: Partial<BannerUma> = {}): RateUpTarget => {
  const banner = { id: 1, umas, ...extra } as BannerUma
  return { type: 'Uma', banner, timeline: banner.banner_timeline }
}
const supportTarget = (
  cards: SupportCard[],
  extra: Partial<BannerSupport> = {},
): RateUpTarget => {
  const banner = { id: 1, support_cards: cards, ...extra } as BannerSupport
  return { type: 'Support', banner, timeline: banner.banner_timeline }
}

const rates = (target: RateUpTarget) => rateUpCards(target, C).map((card) => card.rate)

describe('rateUpCards', () => {
  it('gives one or two ★3s the full 0.75% each', () => {
    expect(rates(umaTarget([uma(1, 3)]))).toEqual([0.0075])
    expect(rates(umaTarget([uma(1, 3), uma(2, 3)]))).toEqual([0.0075, 0.0075])
  })

  it('splits the 3% pool once the rate-ups would overflow it', () => {
    // The 9-uma launch banner: 3% / 9, as the game's own table has it.
    const nine = umaTarget(Array.from({ length: 9 }, (_, i) => uma(i + 1, 3)))
    rates(nine).forEach((rate) => expect(rate).toBeCloseTo(0.03 / 9, 12))

    // The 20-card launch support banner: 0.15% each.
    const twenty = supportTarget(Array.from({ length: 20 }, (_, i) => support(i + 1, 3)))
    rates(twenty).forEach((rate) => expect(rate).toBeCloseTo(0.0015, 12))
  })

  it('still gives four ★3s 0.75% each, since 4 x 0.75% is exactly the pool', () => {
    const four = umaTarget([1, 2, 3, 4].map((id) => uma(id, 3)))
    rates(four).forEach((rate) => expect(rate).toBeCloseTo(0.0075, 12))
  })

  it('rates each rarity against its own pool', () => {
    // Kitasan Black (★3) + Matikanetannhauser (★2): 0.75% and 2.25%.
    expect(rates(umaTarget([uma(1, 3), uma(2, 2)]))).toEqual([0.0075, 0.0225])
    // Three SRs share 3%, so 1% each; a lone R is 3.75%; two Rs 2.5% each.
    rates(supportTarget([support(1, 2), support(2, 2), support(3, 2)])).forEach((rate) =>
      expect(rate).toBeCloseTo(0.01, 12),
    )
    expect(rates(supportTarget([support(1, 1)]))).toEqual([0.0375])
    expect(rates(supportTarget([support(1, 1), support(2, 1)]))).toEqual([0.025, 0.025])
  })

  it('reads a missing rarity as ★3/SSR', () => {
    expect(rates(umaTarget([uma(1, null), uma(2)]))).toEqual([0.0075, 0.0075])
  })

  it('splits by the picks on a select banner, not by the list', () => {
    // "10 Select 2": ten listed, two chosen, two sharing the pool. Splitting by
    // the list would give 0.3% each.
    const select = supportTarget(
      Array.from({ length: 10 }, (_, i) => support(i + 1, 3)),
      { rate_up_picks: 2 },
    )
    expect(new Set(rates(select))).toEqual(new Set([0.0075]))
  })

  it('lets an override win over the rule', () => {
    // The 2025-07-16 anime-collab doubles were 0.5% each.
    const collab = umaTarget([uma(1, 3), uma(2, 3)], { rate_overrides: { 1: 0.005, 2: 0.005 } })
    expect(rates(collab)).toEqual([0.005, 0.005])
  })

  it('reads its numbers from the constants it is given', () => {
    const tuned = { ...C, rate_up_rate_3: 0.01 }
    expect(rateUpCards(umaTarget([uma(1, 3)]), tuned)[0].rate).toBe(0.01)
  })
})

describe('primaryRateUpCard', () => {
  it('picks the highest rarity, so a ★3 + ★2 banner shows the ★3', () => {
    const mixed = umaTarget([uma(7, 2), uma(8, 3)])
    expect(primaryRateUpCard(mixed, C)?.id).toBe(8)
  })

  it('keeps the banner order among equals', () => {
    expect(primaryRateUpCard(umaTarget([uma(4, 3), uma(5, 3)]), C)?.id).toBe(4)
  })

  it('is null for a banner with no featured cards yet', () => {
    expect(primaryRateUpCard(umaTarget([]), C)).toBeNull()
  })
})

describe('rowRateUpRate', () => {
  it('uses a lone ★2 banner’s own rate, not 0.75%', () => {
    expect(rowRateUpRate(umaTarget([uma(1, 2)]), C)).toBe(0.0225)
  })

  it('falls back to the ★3/SSR rate when there is no card to rate', () => {
    expect(rowRateUpRate(umaTarget([]), C)).toBe(C.rate_up_rate_3)
  })
})
