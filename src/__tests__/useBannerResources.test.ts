import { renderHook } from '@testing-library/react'
import { useBannerResources } from '../hooks/useBannerResources'
import {
  DAILY_BASE_CARATS,
  PULL_COST_CARATS,
} from '../constants/gameConstants'
import type {
  UserStats,
  ClubRank,
  TeamTrialsRank,
  ChampionsMeetingRank,
  LeagueOfHeroesRank,
  UserPlannedBanner,
  EventReward,
  ChampionsMeeting,
  LeagueOfHeroes,
} from '../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns a date string N days from today. */
function daysFromNow(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** User stats with all income disabled and 0 resources — the minimal baseline. */
const zeroStats: UserStats = {
  current_carat: 0,
  current_paid_carat: 0,
  uma_ticket: 0,
  support_ticket: 0,
  daily_carat: false,
  training_pass: false,
  // rank IDs that map to income_amount: 0 via the noRank fixtures below
  club_rank: 1,
  team_trials_rank: 1,
  champions_meeting_rank: 1,
  league_of_heroes_rank: 1,
  ssr_crystals: 0,
  sr_crystals: 0,
  ssr_shards: 0,
  sr_shards: 0,
}

const noRank: ClubRank = { id: 1, name: 'None', income_amount: 0 }
const noTeamTrialsRank: TeamTrialsRank = { id: 1, name: 'None', income_amount: 0 }
const noCmRank: ChampionsMeetingRank = { id: 1, name: 'None', income_amount: 0 }
const noLohRank: LeagueOfHeroesRank = { id: 1, name: 'None', income_amount: 0 }

/** Shared "no extra income" rank arrays used across most tests. */
const noIncome = {
  clubRankData: [noRank],
  teamTrialsRankData: [noTeamTrialsRank],
  championsMeetingRankData: [noCmRank],
  leagueOfHeroesRankData: [noLohRank],
  eventRewardsData: [] as EventReward[],
  championsMeetingData: [] as ChampionsMeeting[],
  leagueOfHeroesData: [] as LeagueOfHeroes[],
}

function makeUmaBanner(id: number, endDate: string, pulls: number): UserPlannedBanner {
  return {
    id,
    user: 1,
    number_of_pulls: pulls,
    banner_uma: {
      id,
      name: `Uma Banner ${id}`,
      admin_comments: '',
      umas: [],
      free_pulls: 0,
      banner_timeline: {
        id,
        name: `Timeline ${id}`,
        start_date: daysFromNow(0),
        end_date: endDate,
        image: '',
      },
    },
    banner_support: null,
  }
}

function makeSupportBanner(id: number, endDate: string, pulls: number): UserPlannedBanner {
  return {
    id,
    user: 1,
    number_of_pulls: pulls,
    banner_support: {
      id,
      name: `Support Banner ${id}`,
      admin_comments: '',
      support_cards: [],
      free_pulls: 0,
      banner_timeline: {
        id,
        name: `Timeline ${id}`,
        start_date: daysFromNow(0),
        end_date: endDate,
        image: '',
      },
    },
    banner_uma: null,
  }
}

function makeEventReward(id: number, date: string, caratAmount: number): EventReward {
  return {
    id,
    name: `Event ${id}`,
    carat_amount: caratAmount,
    support_ticket_amount: 0,
    uma_ticket_amount: 0,
    sr_shard_amount: 0,
    sr_crystal_amount: 0,
    ssr_shard_amount: 0,
    ssr_crystal_amount: 0,
    date,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useBannerResources', () => {
  describe('null / empty inputs', () => {
    it('returns an empty array when userStatsData is null', () => {
      const { result } = renderHook(() =>
        useBannerResources({
          userStatsData: null,
          userPlannedBannerData: [makeUmaBanner(1, daysFromNow(30), 0)],
          ...noIncome,
        })
      )
      expect(result.current).toEqual([])
    })

    it('returns an empty array when no banners are planned', () => {
      const { result } = renderHook(() =>
        useBannerResources({
          userStatsData: zeroStats,
          userPlannedBannerData: [],
          ...noIncome,
        })
      )
      expect(result.current).toEqual([])
    })
  })

  describe('result count', () => {
    it('returns one result per planned banner', () => {
      const { result } = renderHook(() =>
        useBannerResources({
          userStatsData: zeroStats,
          userPlannedBannerData: [
            makeUmaBanner(1, daysFromNow(10), 0),
            makeUmaBanner(2, daysFromNow(20), 0),
            makeUmaBanner(3, daysFromNow(30), 0),
          ],
          ...noIncome,
        })
      )
      expect(result.current).toHaveLength(3)
    })
  })

  describe('starting resources', () => {
    it('includes current_carat and current_paid_carat in the opening balance', () => {
      // 1 banner ending tomorrow — only 2 days of daily base income in the window.
      // With current_carat = 10000, result carats must be >= 10000.
      const { result } = renderHook(() =>
        useBannerResources({
          userStatsData: { ...zeroStats, current_carat: 10_000 },
          userPlannedBannerData: [makeUmaBanner(1, daysFromNow(1), 0)],
          ...noIncome,
        })
      )
      expect(result.current[0].carats).toBeGreaterThanOrEqual(10_000)
    })

    it('sums current_carat and current_paid_carat together', () => {
      const { result } = renderHook(() =>
        useBannerResources({
          userStatsData: { ...zeroStats, current_carat: 3_000, current_paid_carat: 2_000 },
          userPlannedBannerData: [makeUmaBanner(1, daysFromNow(1), 0)],
          ...noIncome,
        })
      )
      // Combined starting balance is 5000; daily income is additive, so >= 5000
      expect(result.current[0].carats).toBeGreaterThanOrEqual(5_000)
    })
  })

  describe('pull cost deduction', () => {
    // Results are pushed BEFORE deduction, so to observe the after-deduction state
    // we need a second banner and check results[1].

    it('deducts carat cost when there are no tickets available', () => {
      // 3 uma pulls at 150 carats each = 450 carats.
      // Period from now to banner 1 is 1 day → at most ~175 carats income.
      // Starting with 0 carats, after deduction carats should be negative.
      const { result } = renderHook(() =>
        useBannerResources({
          userStatsData: zeroStats,
          userPlannedBannerData: [
            makeUmaBanner(1, daysFromNow(1), 3),
            makeUmaBanner(2, daysFromNow(2), 0), // sentinel to observe state after deduction
          ],
          ...noIncome,
        })
      )
      // results[1] reflects the balance after banner 1's pulls were paid
      const afterDeduction = result.current[1].carats
      // DAILY_BASE_CARATS * 2 days (max income) < 3 * PULL_COST_CARATS, so balance is negative
      expect(afterDeduction).toBeLessThan(0)
    })
  })

  describe('uma ticket deduction before carats', () => {
    it('consumes uma tickets instead of carats for uma banners', () => {
      // 3 tickets cover 3 uma pulls → carats should NOT be deducted.
      // Starting with 10,000 carats: after banner 1, carats should still be >= 10,000.
      const { result } = renderHook(() =>
        useBannerResources({
          userStatsData: { ...zeroStats, current_carat: 10_000, uma_ticket: 3 },
          userPlannedBannerData: [
            makeUmaBanner(1, daysFromNow(1), 3),
            makeUmaBanner(2, daysFromNow(2), 0),
          ],
          ...noIncome,
        })
      )
      // Tickets available before banner 1's deduction
      expect(result.current[0].umaTickets).toBe(3)

      // After banner 1: tickets spent, carats untouched (income only adds, never subtracts)
      expect(result.current[1].umaTickets).toBe(0)
      expect(result.current[1].carats).toBeGreaterThanOrEqual(10_000)
    })

    it('falls back to carats once uma tickets are exhausted', () => {
      // Compare two identical scenarios that differ only in ticket count.
      // Partial: 1 ticket covers 1 pull, 2 remaining pulls cost carats (300 total).
      // Full: 3 tickets cover all pulls, 0 carats spent.
      // The partial scenario should have exactly 2 * PULL_COST_CARATS fewer carats
      // in results[1], regardless of how much daily income accumulated.
      const sharedBanners = [
        makeUmaBanner(1, daysFromNow(1), 3),
        makeUmaBanner(2, daysFromNow(2), 0),
      ]
      const { result: partial } = renderHook(() =>
        useBannerResources({
          userStatsData: { ...zeroStats, current_carat: 10_000, uma_ticket: 1 },
          userPlannedBannerData: sharedBanners,
          ...noIncome,
        })
      )
      const { result: full } = renderHook(() =>
        useBannerResources({
          userStatsData: { ...zeroStats, current_carat: 10_000, uma_ticket: 3 },
          userPlannedBannerData: sharedBanners,
          ...noIncome,
        })
      )
      // Partial scenario used up its 1 ticket
      expect(partial.current[1].umaTickets).toBe(0)
      // Full scenario still has 0 tickets after spending all 3
      expect(full.current[1].umaTickets).toBe(0)
      // Carats in partial are exactly 2 pulls cheaper than full (300 carats less)
      expect(partial.current[1].carats).toBe(
        full.current[1].carats - 2 * PULL_COST_CARATS
      )
    })
  })

  describe('support ticket deduction before carats', () => {
    it('consumes support tickets instead of carats for support banners', () => {
      const { result } = renderHook(() =>
        useBannerResources({
          userStatsData: { ...zeroStats, current_carat: 10_000, support_ticket: 3 },
          userPlannedBannerData: [
            makeSupportBanner(1, daysFromNow(1), 3),
            makeSupportBanner(2, daysFromNow(2), 0),
          ],
          ...noIncome,
        })
      )
      expect(result.current[0].supportTickets).toBe(3)
      expect(result.current[1].supportTickets).toBe(0)
      expect(result.current[1].carats).toBeGreaterThanOrEqual(10_000)
    })
  })

  describe('event reward filtering', () => {
    it('adds event rewards whose date falls within the banner window', () => {
      const reward = makeEventReward(1, daysFromNow(15), 1_000)
      const { result } = renderHook(() =>
        useBannerResources({
          userStatsData: zeroStats,
          userPlannedBannerData: [makeUmaBanner(1, daysFromNow(30), 0)],
          ...noIncome,
          eventRewardsData: [reward],
        })
      )
      // Without the reward the balance would be daily income only.
      // With 1000 carats added, it must be >= 1000.
      expect(result.current[0].carats).toBeGreaterThanOrEqual(1_000)
    })

    it('does not add event rewards whose date falls after the banner deadline', () => {
      // Reward is on day 50 but banner ends on day 20 — should be excluded.
      const reward = makeEventReward(1, daysFromNow(50), 1_000)
      const { result } = renderHook(() =>
        useBannerResources({
          userStatsData: zeroStats,
          userPlannedBannerData: [makeUmaBanner(1, daysFromNow(20), 0)],
          ...noIncome,
          eventRewardsData: [reward],
        })
      )
      // 20 days of daily income at 75/day = 1500 max base income.
      // No reward added, so balance < 1500 + potential bonuses.
      // We verify the reward wasn't included by checking the balance is not inflated.
      // Max daily income for 20 days is 20 * (75 + 75) = 3000 (base + max bonus).
      // With reward it would be at least 1000 + 20*75 = 2500+. So if < 4000 it's fine
      // but let's check the specific reward wasn't added by comparing with/without.
      const noRewardResult = renderHook(() =>
        useBannerResources({
          userStatsData: zeroStats,
          userPlannedBannerData: [makeUmaBanner(1, daysFromNow(20), 0)],
          ...noIncome,
          eventRewardsData: [],
        })
      )
      expect(result.current[0].carats).toBe(noRewardResult.result.current[0].carats)
    })

    it('adds uma ticket rewards within the banner window', () => {
      const reward: EventReward = {
        ...makeEventReward(1, daysFromNow(10), 0),
        uma_ticket_amount: 5,
      }
      const { result } = renderHook(() =>
        useBannerResources({
          userStatsData: zeroStats,
          userPlannedBannerData: [makeUmaBanner(1, daysFromNow(30), 0)],
          ...noIncome,
          eventRewardsData: [reward],
        })
      )
      expect(result.current[0].umaTickets).toBe(5)
    })
  })

  describe('multi-banner resource carry-over', () => {
    it('carries remaining carats forward from one banner to the next', () => {
      // Banner 1 ends at day 10; banner 2 ends at day 20.
      // No pulls. Carats should increase monotonically as income accumulates.
      const { result } = renderHook(() =>
        useBannerResources({
          userStatsData: { ...zeroStats, current_carat: 500 },
          userPlannedBannerData: [
            makeUmaBanner(1, daysFromNow(10), 0),
            makeUmaBanner(2, daysFromNow(20), 0),
          ],
          ...noIncome,
        })
      )
      expect(result.current[1].carats).toBeGreaterThan(result.current[0].carats)
    })

    it('deducts pulls from the correct banner in sequence', () => {
      // Banner 1: 10 uma pulls → spends carats.
      // Banner 2: 0 pulls → balance is banner1.balance - cost + period2_income.
      // With 0 tickets and 0 starting carats, banner 2 starts in the red.
      const pulls = 10
      const { result } = renderHook(() =>
        useBannerResources({
          userStatsData: zeroStats,
          userPlannedBannerData: [
            makeUmaBanner(1, daysFromNow(1), pulls),
            makeUmaBanner(2, daysFromNow(2), 0),
          ],
          ...noIncome,
        })
      )
      // Period income is at most ~300 carats (2 days × 2 periods), deduction is 1500.
      // Balance must be well negative.
      expect(result.current[1].carats).toBeLessThan(0)
    })
  })
})
