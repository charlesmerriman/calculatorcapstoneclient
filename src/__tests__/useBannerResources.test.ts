import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useBannerResources } from '../hooks/useBannerResources'
import { PULL_COST_CARATS, DEFAULT_CONSTANTS } from '../constants/gameConstants'
import type {
  UserStats,
  ClubRank,
  TeamTrialsRank,
  ChampionsMeetingRank,
  LeagueOfHeroesRank,
  UserPlannedBanner,
  BannerTimeline,
  AnniversaryEvent,
  UserPlannedPurchase,
  IncomeLedgerRow,
} from '../types'

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** ISO instant N days from now, at the 21:59:59 banners actually end at. */
function daysFromNow(n: number, time = 'T21:59:59Z'): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + n)
  return `${d.toISOString().split('T')[0]}${time}`
}

const zeroStats: UserStats = {
  current_carat: 0,
  current_paid_carat: 0,
  uma_ticket: 0,
  support_ticket: 0,
  uma_selector_ticket: 0,
  support_selector_ticket: 0,
  include_purchases_in_projection: false,
  webstore_bonus: false,
  daily_carat: false,
  training_pass: false,
  misc_earnings: false,
  monthly_shop_tickets: false,
  discounted_paid_pulls: false,
  full_price_paid_pulls: true,
  club_rank: 1,
  team_trials_rank: 1,
  champions_meeting_rank: 1,
  league_of_heroes_rank: 1,
  ssr_crystals: 0,
  sr_crystals: 0,
  ssr_shards: 0,
  sr_shards: 0,
}

const zeroRankRewards = {
  uma_ticket_amount: 0,
  support_ticket_amount: 0,
  ssr_shard_amount: 0,
  sr_shard_amount: 0,
}
const noIncome = {
  clubRankData: [{ id: 1, name: 'None', income_amount: 0 }] as ClubRank[],
  teamTrialsRankData: [{ id: 1, name: 'None', income_amount: 0 }] as TeamTrialsRank[],
  championsMeetingRankData: [
    { id: 1, name: 'None', income_amount: 0, ...zeroRankRewards },
  ] as ChampionsMeetingRank[],
  leagueOfHeroesRankData: [
    { id: 1, name: 'None', income_amount: 0, ...zeroRankRewards },
  ] as LeagueOfHeroesRank[],
  anniversaryEventData: [] as AnniversaryEvent[],
  userPlannedPurchaseData: [] as UserPlannedPurchase[],
  incomeLedger: [] as IncomeLedgerRow[],
  constants: DEFAULT_CONSTANTS,
}

function timeline(id: number, startDay: number, endDay: number): BannerTimeline {
  return {
    id,
    name: `Timeline ${id}`,
    banner_category: 'standard',
    start_date: daysFromNow(startDay, 'T22:00:00Z'),
    end_date: daysFromNow(endDay),
    is_predicted: false,
    jp_start_date: null,
    jp_end_date: null,
    global_start_date: daysFromNow(startDay, 'T22:00:00Z'),
    global_end_date: daysFromNow(endDay),
    schedule_offset_days: 0,
    applied_offset_days: 0,
    image: '',
  }
}

function umaBanner(
  id: number,
  startDay: number,
  endDay: number,
  pulls = 0
): UserPlannedBanner {
  return {
    id,
    user: 1,
    number_of_pulls: pulls,
    reserved_copies: 0,
    banner_uma: {
      id,
      name: `Uma Banner ${id}`,
      admin_comments: '',
      umas: [],
      free_pulls: 0,
      banner_timeline: timeline(id, startDay, endDay),
    },
  }
}

function stepUpBanner(
  id: number,
  startDay: number,
  endDay: number,
  steps = 0,
  bannerCount = 3
): UserPlannedBanner {
  return {
    id,
    user: 1,
    // number_of_pulls carries steps on a step-up row — read via plannedSteps().
    number_of_pulls: steps,
    reserved_copies: 0,
    banner_step_up: {
      id,
      banner_timeline: timeline(id, startDay, endDay),
      anniversary_event: 1,
      name: `Step-Up ${id}`,
      card_type: 'uma',
      banner_count: bannerCount,
      max_steps: bannerCount * 5,
      jp_cutoff_date: '2026-01-30',
      image: null,
      admin_comments: '',
      order: 0,
    },
  }
}

function render(banners: UserPlannedBanner[], stats: Partial<UserStats> = {}, extra = {}) {
  return renderHook(() =>
    useBannerResources({
      userStatsData: { ...zeroStats, ...stats },
      ...noIncome,
      ...extra,
      userPlannedBannerData: banners,
    })
  ).result.current
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('income is a pure function of the end date', () => {
  // This is the invariant that replaces "banner count invariance" from the
  // walk-based engine. It is strictly stronger: rather than proving that
  // chained windows tile, income simply cannot depend on anything but the end
  // date, because nothing about the rest of the plan reaches the calculation.

  it('does not change when other banners are added before it', () => {
    const target = umaBanner(1, 10, 30)
    const alone = render([target])
    const crowded = render([
      umaBanner(2, 1, 5),
      umaBanner(3, 6, 9),
      target,
      umaBanner(4, 11, 20),
    ])
    // No banner spends anything (0 pulls), so the target's estimate must be
    // identical no matter how the timeline is sliced around it.
    expect(crowded[2].freeCarats).toBe(alone[0].freeCarats)
  })

  it('gives two banners sharing an end date the same income', () => {
    const [a, b] = render([umaBanner(1, 1, 20), umaBanner(2, 15, 20)])
    expect(a.freeCarats).toBe(b.freeCarats)
  })

  it('gives a nested banner its own end date\'s income, not the outer one\'s', () => {
    // Banner 2 opens later but closes sooner. Under the old walk this was the
    // case that produced a backwards window and reported the previous banner's
    // balance instead.
    const [outer, nested] = render([umaBanner(1, 1, 60), umaBanner(2, 10, 20)])
    expect(nested.freeCarats).toBeLessThan(outer.freeCarats)
  })

  it('grows monotonically with the end date', () => {
    const results = render([umaBanner(1, 1, 10), umaBanner(2, 2, 40), umaBanner(3, 3, 90)])
    expect(results[0].freeCarats).toBeLessThan(results[1].freeCarats)
    expect(results[1].freeCarats).toBeLessThan(results[2].freeCarats)
  })
})

describe('spend attribution', () => {
  it('charges a later banner for what an earlier one committed', () => {
    const withoutSpend = render([umaBanner(1, 1, 10, 0), umaBanner(2, 20, 30, 0)])
    const withSpend = render([umaBanner(1, 1, 10, 10), umaBanner(2, 20, 30, 0)])
    expect(withoutSpend[1].freeCarats - withSpend[1].freeCarats).toBe(
      10 * PULL_COST_CARATS
    )
  })

  it('does not charge a banner for pulls committed after it', () => {
    const baseline = render([umaBanner(1, 1, 10, 0), umaBanner(2, 20, 30, 0)])
    const laterSpend = render([umaBanner(1, 1, 10, 0), umaBanner(2, 20, 30, 50)])
    expect(laterSpend[0].freeCarats).toBe(baseline[0].freeCarats)
  })

  it('orders spend by START date, so a nested banner pays after the one it sits inside', () => {
    // The outer banner opens first, so it spends first even though it closes
    // last — the sheet's AH44 ordering.
    const results = render([umaBanner(1, 1, 60, 5), umaBanner(2, 10, 20, 5)])
    const [outer, nested] = results
    // The nested banner's balance is already net of the outer banner's spend.
    const nestedAlone = render([umaBanner(2, 10, 20, 5)])
    expect(nested.freeCarats).toBe(nestedAlone[0].freeCarats - 5 * PULL_COST_CARATS)
    expect(outer.freeCarats).toBeGreaterThan(0)
  })

  it('cascades an unaffordable plan forward as a negative balance', () => {
    // Overplanning is reported, not clamped: the shortfall becomes a carat debt
    // on the free balance, which is what the row's red state reads. The banner
    // that overspends still shows its own pre-spend balance; the debt lands on
    // everything after it.
    const results = render([umaBanner(1, 1, 10, 1000), umaBanner(2, 20, 30, 0)])
    expect(results[0].freeCarats).toBeGreaterThanOrEqual(0)
    expect(results[1].freeCarats).toBeLessThan(0)
  })

  it('floors paid carats at zero while free carats absorb the debt', () => {
    const results = render([umaBanner(1, 1, 10, 1000), umaBanner(2, 20, 30, 0)], {
      current_paid_carat: 100,
      discounted_paid_pulls: true,
    })
    expect(results[1].paidCarats).toBeGreaterThanOrEqual(0)
    expect(results[1].freeCarats).toBeLessThan(0)
  })
})

describe('ledger rewards', () => {
  const ledgerRow = (overrides: Partial<IncomeLedgerRow>): IncomeLedgerRow => ({
    date: daysFromNow(5, 'T22:00:00Z'),
    kind: 'event',
    source_id: 1,
    name: 'Event',
    is_predicted: false,
    throughout_end: null,
    carats: 0,
    carats_throughout: 0,
    uma_tickets: 0,
    support_tickets: 0,
    ssr_shards: 0,
    ssr_crystals: 0,
    sr_shards: 0,
    sr_crystals: 0,
    ...overrides,
  })

  it('credits event carats and tickets that land before the end date', () => {
    const baseline = render([umaBanner(1, 1, 30)])
    const withEvent = render([umaBanner(1, 1, 30)], {}, {
      incomeLedger: [ledgerRow({ carats: 1200, uma_tickets: 3 })],
    })
    expect(withEvent[0].freeCarats - baseline[0].freeCarats).toBe(1200)
    expect(withEvent[0].umaTickets).toBe(3)
  })

  it('excludes an event landing after the end date', () => {
    const baseline = render([umaBanner(1, 1, 10)])
    const withEvent = render([umaBanner(1, 1, 10)], {}, {
      incomeLedger: [ledgerRow({ date: daysFromNow(50, 'T22:00:00Z'), carats: 1200 })],
    })
    expect(withEvent[0].freeCarats).toBe(baseline[0].freeCarats)
  })

  it('scales race events by the user\'s rank', () => {
    const rankedIncome = {
      ...noIncome,
      championsMeetingRankData: [
        { id: 1, name: 'Ranked', income_amount: 1250, ...zeroRankRewards, uma_ticket_amount: 2 },
      ] as ChampionsMeetingRank[],
      incomeLedger: [
        ledgerRow({ kind: 'champions_meeting', date: daysFromNow(5, 'T00:00:00Z') }),
      ],
    }
    const baseline = render([umaBanner(1, 1, 30)])
    const withRace = render([umaBanner(1, 1, 30)], {}, rankedIncome)
    expect(withRace[0].freeCarats - baseline[0].freeCarats).toBe(1250)
    expect(withRace[0].umaTickets).toBe(2)
  })
})

describe('result shape', () => {
  it('aligns results positionally with the input list, not the spend order', () => {
    // Banner 2 opens first, so it resolves first — but its result must still
    // land in slot 1, where it appears on screen.
    const results = render([umaBanner(1, 20, 30), umaBanner(2, 1, 10)])
    expect(results).toHaveLength(2)
    expect(results[1].freeCarats).toBeLessThan(results[0].freeCarats)
  })

  it('leaves a zeroed slot for a banner with no resolvable end date', () => {
    const undated: UserPlannedBanner = {
      id: 9,
      user: 1,
      number_of_pulls: 0,
      reserved_copies: 0,
      banner_uma: {
        id: 9,
        name: 'Undated',
        admin_comments: '',
        umas: [],
        free_pulls: 0,
        banner_timeline: undefined as unknown as BannerTimeline,
      },
    }
    const results = render([undated, umaBanner(1, 1, 30)])
    expect(results[0].freeCarats).toBe(0)
    expect(results[0].maxPossiblePulls).toBe(0)
    expect(results[1].freeCarats).toBeGreaterThan(0)
  })

  it('returns an empty array with no user stats', () => {
    const results = renderHook(() =>
      useBannerResources({
        userStatsData: null,
        ...noIncome,
        userPlannedBannerData: [umaBanner(1, 1, 30)],
      })
    ).result.current
    expect(results).toEqual([])
  })
})

// ── Step-up rows ──────────────────────────────────────────────────────────────

describe('step-up rows', () => {
  it('reports step fields on a step-up row and omits them on a normal one', () => {
    const [step, uma] = render([stepUpBanner(1, 1, 10, 7), umaBanner(2, 1, 10)], {
      current_paid_carat: 20_000,
    })
    expect(step.chargeableSteps).toBe(7)
    expect(step.stepLabel).toBe('5x1-2')
    // Three banners exist (15 steps) and 20,000 carats reach 20, so existence binds.
    expect(step.maxPossibleSteps).toBe(15)
    // A step-up has no pulls in the "Max Pulls" sense — the row relabels the column.
    expect(step.maxPossiblePulls).toBe(0)

    expect(uma.chargeableSteps).toBeUndefined()
    expect(uma.maxPossibleSteps).toBeUndefined()
    expect(uma.stepLabel).toBeUndefined()
  })

  it('spends paid carats and nothing else', () => {
    // The defining constraint. Compared against the same plan at zero steps so
    // income is identical and only the spend differs.
    const spent = render([stepUpBanner(1, 1, 10, 5), umaBanner(2, 20, 30)], {
      current_carat: 3_000,
      current_paid_carat: 10_000,
      uma_ticket: 4,
      support_ticket: 4,
    })
    const unspent = render([stepUpBanner(1, 1, 10, 0), umaBanner(2, 20, 30)], {
      current_carat: 3_000,
      current_paid_carat: 10_000,
      uma_ticket: 4,
      support_ticket: 4,
    })

    expect(spent[1].paidCarats).toBe(unspent[1].paidCarats - 5_000)
    expect(spent[1].freeCarats).toBe(unspent[1].freeCarats)
    expect(spent[1].umaTickets).toBe(unspent[1].umaTickets)
    expect(spent[1].supportTickets).toBe(unspent[1].supportTickets)
  })

  it('floors a later row at zero paid carats when the plan outruns the balance', () => {
    const results = render([stepUpBanner(1, 1, 10, 15), umaBanner(2, 20, 30)], {
      current_paid_carat: 1_000,
    })
    // 15 steps cost 15,000 against 1,000 available: charged in full, floored for
    // display on the next row, and the red input comes from maxPossibleSteps.
    expect(results[0].maxPossibleSteps).toBe(1)
    expect(results[1].paidCarats).toBe(0)
  })

  it('ignores reserved copies, which are disabled on step-up rows in v1', () => {
    const banner = stepUpBanner(1, 1, 10, 5)
    banner.reserved_copies = 3
    const [row] = render([banner], {
      current_paid_carat: 10_000,
      uma_selector_ticket: 5,
      ssr_crystals: 5,
    })
    expect(row.reservedFunding).toEqual({ selectors: 0, crystals: 0, unfunded: 0 })
    expect(row.ssrCrystals).toBe(5)
  })

  it('charges rows sharing a window in display order', () => {
    // Same timeline start, so the tiebreak is position on the sheet. Each row
    // reports its PRE-spend balance, so the second one shows the first's damage.
    const stepFirst = render(
      [stepUpBanner(1, 1, 10, 5), umaBanner(2, 1, 10, 10)],
      { current_paid_carat: 10_000 }
    )
    expect(stepFirst[0].paidCarats).toBe(10_000)
    expect(stepFirst[1].paidCarats).toBe(5_000)

    // Reversed, the uma row is charged first and the step-up sees the damage.
    // Asserted against the same plan at zero pulls rather than a literal, because
    // free carats absorb part of a full-price pull before paid carats are touched.
    const umaFirst = render(
      [umaBanner(2, 1, 10, 10), stepUpBanner(1, 1, 10, 5)],
      { current_paid_carat: 10_000 }
    )
    const umaFirstIdle = render(
      [umaBanner(2, 1, 10, 0), stepUpBanner(1, 1, 10, 5)],
      { current_paid_carat: 10_000 }
    )
    expect(umaFirst[0].paidCarats).toBe(10_000)
    expect(umaFirst[1].paidCarats).toBeLessThan(umaFirstIdle[1].paidCarats)
    expect(umaFirstIdle[1].paidCarats).toBe(10_000)
  })

  it('competes with discounted pulls for the same paid pool', () => {
    // The one user-visible interaction with no equivalent elsewhere in the
    // projection: both draw paid carats, and walk order decides who drains it.
    const withStepUp = render(
      [stepUpBanner(1, 1, 10, 5), umaBanner(2, 20, 30, 20)],
      { current_paid_carat: 10_000, discounted_paid_pulls: true }
    )
    const alone = render([umaBanner(2, 20, 30, 20)], {
      current_paid_carat: 10_000,
      discounted_paid_pulls: true,
    })
    expect(withStepUp[1].maxPossiblePulls).toBeLessThan(alone[0].maxPossiblePulls)
  })
})
