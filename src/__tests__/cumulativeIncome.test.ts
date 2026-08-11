import { describe, it, expect } from 'vitest'
import {
  cumulativeClubRankCarats,
  cumulativeDailyCarats,
  cumulativeDailyCaratPack,
  cumulativeLoginAndGiftCarats,
  cumulativeMiscEarningsCarats,
  cumulativeMonthlyShopTickets,
  cumulativeTeamTrialsCarats,
  cumulativeTrainingPassIncome,
} from '../utils/cumulativeIncome'
import {
  DAILY_CARAT_PACK_PER_DAY,
  DAILY_CARAT_PACK_PAID_CARATS,
  FIFTY_DAY_LOGIN_PER_CYCLE,
  MISC_EARNINGS_PER_DAY,
  MISC_EARNINGS_DELAY_DAYS,
  MONTHLY_SHOP_UMA_TICKETS,
  VALENTINES_CARATS,
  WHITE_DAY_CARATS,
  MONTHLY_BASE_REWARD,
  TRAINING_PASS_MONTHLY_FREE_CARATS,
  TRAINING_PASS_MONTHLY_PAID_CARATS,
} from '../constants/gameConstants'
import { addUtcDays } from '../utils/utcDates'

const utc = (iso: string) => new Date(iso)

// 2026-08-11 is a Tuesday; the Monday of its week is 2026-08-10.
const TODAY = utc('2026-08-11T00:00:00Z')

describe('cumulativeDailyCarats', () => {
  it('applies the blended 75 + 150/7 rate, ceilinged to ten', () => {
    // A whole week is 7*75 + 150 = 675 exactly.
    expect(cumulativeDailyCarats(TODAY, addUtcDays(TODAY, 7))).toBe(680)
    expect(cumulativeDailyCarats(TODAY, addUtcDays(TODAY, 14))).toBe(1350)
  })

  it('does not depend on which weekday the projection is anchored to', () => {
    // The point of the blend: the old day-by-day pattern was phased off today,
    // so the same 7-day span paid differently depending on when you opened it.
    const wednesday = utc('2026-08-12T00:00:00Z')
    expect(cumulativeDailyCarats(wednesday, addUtcDays(wednesday, 7))).toBe(
      cumulativeDailyCarats(TODAY, addUtcDays(TODAY, 7))
    )
  })

  it('earns nothing for a backwards or empty span', () => {
    expect(cumulativeDailyCarats(TODAY, TODAY)).toBe(0)
    expect(cumulativeDailyCarats(TODAY, addUtcDays(TODAY, -5))).toBe(0)
  })
})

describe('cumulativeTeamTrialsCarats', () => {
  it('counts complete weeks from the Monday of the CURRENT week', () => {
    // Measured from Mon 2026-08-10, not from today, so a banner only six days
    // out already carries one payout.
    expect(cumulativeTeamTrialsCarats(TODAY, utc('2026-08-17T00:00:00Z'), 375)).toBe(375)
    expect(cumulativeTeamTrialsCarats(TODAY, utc('2026-08-16T00:00:00Z'), 375)).toBe(0)
  })

  it('is zero for a rank with no income', () => {
    expect(cumulativeTeamTrialsCarats(TODAY, addUtcDays(TODAY, 90), 0)).toBe(0)
  })
})

describe('cumulativeClubRankCarats', () => {
  it('counts complete months from the 1st of the current month', () => {
    expect(cumulativeClubRankCarats(TODAY, utc('2026-09-01T00:00:00Z'), 4500)).toBe(4500)
    expect(cumulativeClubRankCarats(TODAY, utc('2026-08-31T00:00:00Z'), 4500)).toBe(0)
    expect(cumulativeClubRankCarats(TODAY, utc('2026-11-01T00:00:00Z'), 4500)).toBe(13500)
  })
})

describe('cumulativeMiscEarningsCarats', () => {
  it('pays nothing until the ramp-in has elapsed', () => {
    const rampEnd = addUtcDays(TODAY, MISC_EARNINGS_DELAY_DAYS)
    expect(cumulativeMiscEarningsCarats(TODAY, rampEnd)).toBe(0)
    expect(cumulativeMiscEarningsCarats(TODAY, addUtcDays(rampEnd, 10))).toBe(
      10 * MISC_EARNINGS_PER_DAY
    )
  })
})

describe('cumulativeLoginAndGiftCarats', () => {
  it('pays the 50-day login once per completed cycle', () => {
    expect(cumulativeLoginAndGiftCarats(TODAY, addUtcDays(TODAY, 49))).toBe(0)
    expect(cumulativeLoginAndGiftCarats(TODAY, addUtcDays(TODAY, 50))).toBe(
      FIFTY_DAY_LOGIN_PER_CYCLE
    )
    expect(cumulativeLoginAndGiftCarats(TODAY, addUtcDays(TODAY, 100))).toBe(
      2 * FIFTY_DAY_LOGIN_PER_CYCLE
    )
  })

  it('credits the next Valentine\'s but not a White Day beyond the end date', () => {
    // From 2026-08-11 the next occurrences are 2027-02-14 and 2027-03-14.
    const justAfterValentines = utc('2027-02-20T00:00:00Z')
    const cycles = Math.floor(
      (justAfterValentines.getTime() - TODAY.getTime()) / 86_400_000 / 50
    )
    expect(cumulativeLoginAndGiftCarats(TODAY, justAfterValentines)).toBe(
      cycles * FIFTY_DAY_LOGIN_PER_CYCLE + VALENTINES_CARATS
    )
  })

  it('credits both gifts once the end date clears them', () => {
    const afterBoth = utc('2027-03-20T00:00:00Z')
    const cycles = Math.floor((afterBoth.getTime() - TODAY.getTime()) / 86_400_000 / 50)
    expect(cumulativeLoginAndGiftCarats(TODAY, afterBoth)).toBe(
      cycles * FIFTY_DAY_LOGIN_PER_CYCLE + VALENTINES_CARATS + WHITE_DAY_CARATS
    )
  })

  it('credits a second Valentine\'s a year later', () => {
    const twoValentines = utc('2028-02-20T00:00:00Z')
    const total = cumulativeLoginAndGiftCarats(TODAY, twoValentines)
    const oneValentine = cumulativeLoginAndGiftCarats(TODAY, utc('2027-02-20T00:00:00Z'))
    // Two Valentine's, two White Days, plus the extra login cycles between.
    expect(total - oneValentine).toBeGreaterThan(VALENTINES_CARATS + WHITE_DAY_CARATS)
  })
})

describe('cumulativeDailyCaratPack', () => {
  it('drips daily to free carats and pays the repurchase bonus every 30 days', () => {
    expect(cumulativeDailyCaratPack(TODAY, addUtcDays(TODAY, 29))).toEqual({
      freeCarats: 29 * DAILY_CARAT_PACK_PER_DAY,
      paidCarats: 0,
    })
    expect(cumulativeDailyCaratPack(TODAY, addUtcDays(TODAY, 60))).toEqual({
      freeCarats: 60 * DAILY_CARAT_PACK_PER_DAY,
      paidCarats: 2 * DAILY_CARAT_PACK_PAID_CARATS,
    })
  })
})

describe('cumulativeMonthlyShopTickets', () => {
  it('counts months from the 2nd, so a banner ending on the 1st gets nothing', () => {
    expect(cumulativeMonthlyShopTickets(TODAY, utc('2026-09-01T00:00:00Z')).umaTickets).toBe(0)
    expect(cumulativeMonthlyShopTickets(TODAY, utc('2026-09-02T00:00:00Z')).umaTickets).toBe(
      MONTHLY_SHOP_UMA_TICKETS
    )
  })
})

describe('cumulativeTrainingPassIncome', () => {
  it('earns nothing before the feature launches', () => {
    expect(cumulativeTrainingPassIncome(TODAY, addUtcDays(TODAY, 30), true)).toEqual({
      freeCarats: 0,
      paidCarats: 0,
      umaTickets: 0,
      supportTickets: 0,
    })
  })

  it('clamps a span that straddles the launch date', () => {
    // Launch is 2027-08-15. One complete month past it is 2027-09-15.
    const oneMonthAfterLaunch = utc('2027-09-15T00:00:00Z')
    const paid = cumulativeTrainingPassIncome(TODAY, oneMonthAfterLaunch, true)
    expect(paid.freeCarats).toBe(TRAINING_PASS_MONTHLY_FREE_CARATS)
    expect(paid.paidCarats).toBe(TRAINING_PASS_MONTHLY_PAID_CARATS)
  })

  it('gives the free tier its own carats and no paid carats', () => {
    const free = cumulativeTrainingPassIncome(TODAY, utc('2027-09-15T00:00:00Z'), false)
    expect(free.freeCarats).toBe(MONTHLY_BASE_REWARD)
    expect(free.paidCarats).toBe(0)
  })

  it('stacks the paid pass\'s bonus tickets on top of the free tier\'s', () => {
    const end = utc('2027-09-15T00:00:00Z')
    const free = cumulativeTrainingPassIncome(TODAY, end, false)
    const paid = cumulativeTrainingPassIncome(TODAY, end, true)
    expect(paid.umaTickets).toBeGreaterThan(free.umaTickets)
    expect(free.umaTickets).toBeGreaterThan(0)
  })
})
