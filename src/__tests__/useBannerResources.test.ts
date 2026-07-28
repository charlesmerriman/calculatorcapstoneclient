import { renderHook } from '@testing-library/react'
import { differenceInDays, max, startOfDay } from 'date-fns'
import { useBannerResources } from '../hooks/useBannerResources'
import {
  DAILY_CARAT_PACK_PER_DAY,
  PULL_COST_CARATS,
  DISCOUNTED_PULL_COST_CARATS,
  MISC_EARNINGS_PER_CYCLE,
  FIFTY_DAY_LOGIN_PER_MONTH,
  MONTHLY_SHOP_UMA_TICKETS,
  MONTHLY_SHOP_SUPPORT_TICKETS,
} from '../constants/gameConstants'
import {
  calculateDailyIncome,
  calculateMonthlyOccurrences,
} from '../utils/incomeCalculationUtils'
import type {
  UserStats,
  ClubRank,
  TeamTrialsRank,
  ChampionsMeetingRank,
  LeagueOfHeroesRank,
  UserPlannedBanner,
  GameEvent,
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
  // misc_earnings gates the flat 1,800-per-30-days approximation; off here so
  // the exact-diff tests below aren't perturbed by it (the misc tests flip it on).
  misc_earnings: false,
  // New opt-in features off; full_price_paid_pulls on (the default) so paid
  // carats behave like the old merged pool. Paid carats are 0 here anyway, so
  // these don't affect the existing exact-total tests.
  monthly_shop_tickets: false,
  discounted_paid_pulls: false,
  full_price_paid_pulls: true,
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
const zeroRankRewards = {
  uma_ticket_amount: 0,
  support_ticket_amount: 0,
  ssr_shard_amount: 0,
  sr_shard_amount: 0,
}
const noCmRank: ChampionsMeetingRank = { id: 1, name: 'None', income_amount: 0, ...zeroRankRewards }
const noLohRank: LeagueOfHeroesRank = { id: 1, name: 'None', income_amount: 0, ...zeroRankRewards }

/** Shared "no extra income" rank arrays used across most tests. */
const noIncome = {
  clubRankData: [noRank],
  teamTrialsRankData: [noTeamTrialsRank],
  championsMeetingRankData: [noCmRank],
  leagueOfHeroesRankData: [noLohRank],
  gameEventsData: [] as GameEvent[],
  championsMeetingData: [] as ChampionsMeeting[],
  leagueOfHeroesData: [] as LeagueOfHeroes[],
}

function makeUmaBanner(id: number, endDate: string, pulls: number, freePulls = 0): UserPlannedBanner {
  return {
    id,
    user: 1,
    number_of_pulls: pulls,
    banner_uma: {
      id,
      name: `Uma Banner ${id}`,
      admin_comments: '',
      umas: [],
      free_pulls: freePulls,
      banner_timeline: {
        id,
        name: `Timeline ${id}`,
        start_date: daysFromNow(0),
        end_date: endDate,
        is_predicted: false,
        jp_start_date: null,
        jp_end_date: null,
        global_start_date: daysFromNow(0),
        global_end_date: endDate,
        image: '',
      },
    },
    banner_support: null,
  }
}

function makeChampionsMeeting(id: number, endDate: string): ChampionsMeeting {
  return {
    id,
    name: `CM ${id}`,
    cm_number: id,
    start_date: daysFromNow(0),
    end_date: endDate,
    is_predicted: false,
    jp_start_date: null,
    jp_end_date: null,
    global_start_date: daysFromNow(0),
    global_end_date: endDate,
    image: '',
    track: 'Tokyo',
    surface_type: 'Turf',
    distance: 'Long',
    length: '2400m',
    track_condition: 'Good',
    season: 'Spring',
    weather: 'Sunny',
    direction: 'Right',
    speed_recommendation: '1200',
    stamina_recommendation: '1200',
    power_recommendation: '1000',
    guts_recommendation: '800',
    wit_recommendation: '800',
  }
}

function makeLeagueOfHeroes(id: number, endDate: string): LeagueOfHeroes {
  return {
    id,
    name: `LoH ${id}`,
    start_date: daysFromNow(0),
    end_date: endDate,
    is_predicted: false,
    jp_start_date: null,
    jp_end_date: null,
    global_start_date: daysFromNow(0),
    global_end_date: endDate,
    image: null,
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
        is_predicted: false,
        jp_start_date: null,
        jp_end_date: null,
        global_start_date: daysFromNow(0),
        global_end_date: endDate,
        image: '',
      },
    },
    banner_uma: null,
  }
}

/**
 * GameEvent used to carry only reward amounts via a separate EventReward
 * model (one-to-many with GameEvent). It's since been folded onto GameEvent
 * directly (see types/events.ts) — carat_amount is a lump earned on
 * start_date, carats_throughout is prorated across start_date..end_date.
 */
function makeGameEvent(
  id: number,
  startDate: string | null,
  endDate: string | null,
  caratAmount: number,
  caratsThroughout = 0
): GameEvent {
  return {
    id,
    name: `Event ${id}`,
    image: null,
    start_date: startDate,
    end_date: endDate,
    is_predicted: false,
    banner_timeline: null,
    carat_amount: caratAmount,
    carats_throughout: caratsThroughout,
    support_ticket_amount: 0,
    uma_ticket_amount: 0,
    sr_shard_amount: 0,
    sr_crystal_amount: 0,
    ssr_shard_amount: 0,
    ssr_crystal_amount: 0,
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
    it('adds event rewards whose start_date falls within the banner window', () => {
      const event = makeGameEvent(1, daysFromNow(15), daysFromNow(15), 1_000)
      const { result } = renderHook(() =>
        useBannerResources({
          userStatsData: zeroStats,
          userPlannedBannerData: [makeUmaBanner(1, daysFromNow(30), 0)],
          ...noIncome,
          gameEventsData: [event],
        })
      )
      // Without the reward the balance would be daily income only.
      // With 1000 carats added, it must be >= 1000.
      expect(result.current[0].carats).toBeGreaterThanOrEqual(1_000)
    })

    it('does not add event rewards whose start_date falls after the banner deadline', () => {
      // Event starts on day 50 but banner ends on day 20 — should be excluded.
      const event = makeGameEvent(1, daysFromNow(50), daysFromNow(50), 1_000)
      const { result } = renderHook(() =>
        useBannerResources({
          userStatsData: zeroStats,
          userPlannedBannerData: [makeUmaBanner(1, daysFromNow(20), 0)],
          ...noIncome,
          gameEventsData: [event],
        })
      )
      const noRewardResult = renderHook(() =>
        useBannerResources({
          userStatsData: zeroStats,
          userPlannedBannerData: [makeUmaBanner(1, daysFromNow(20), 0)],
          ...noIncome,
          gameEventsData: [],
        })
      )
      expect(result.current[0].carats).toBe(noRewardResult.result.current[0].carats)
    })

    it('adds uma ticket rewards within the banner window', () => {
      const event: GameEvent = {
        ...makeGameEvent(1, daysFromNow(10), daysFromNow(10), 0),
        uma_ticket_amount: 5,
      }
      const { result } = renderHook(() =>
        useBannerResources({
          userStatsData: zeroStats,
          userPlannedBannerData: [makeUmaBanner(1, daysFromNow(30), 0)],
          ...noIncome,
          gameEventsData: [event],
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

    it('does not count an event reward twice when two banners share the same window', () => {
      // Event starts in banner 1's window (day 0–10). When banner 2 is processed
      // (day 10–20), lastEndDate = day 10, so the day-5 start is excluded.
      const event = makeGameEvent(1, daysFromNow(5), daysFromNow(5), 1_000)
      const { result: withReward } = renderHook(() =>
        useBannerResources({
          userStatsData: zeroStats,
          userPlannedBannerData: [
            makeUmaBanner(1, daysFromNow(10), 0),
            makeUmaBanner(2, daysFromNow(20), 0),
          ],
          ...noIncome,
          gameEventsData: [event],
        })
      )
      const { result: noReward } = renderHook(() =>
        useBannerResources({
          userStatsData: zeroStats,
          userPlannedBannerData: [
            makeUmaBanner(1, daysFromNow(10), 0),
            makeUmaBanner(2, daysFromNow(20), 0),
          ],
          ...noIncome,
          gameEventsData: [],
        })
      )
      // Banner 1 gets +1000 from the reward; it carries into banner 2's opening balance.
      expect(withReward.current[0].carats - noReward.current[0].carats).toBe(1_000)
      // Banner 2's extra is still just 1000 (carried over), not 2000.
      expect(withReward.current[1].carats - noReward.current[1].carats).toBe(1_000)
    })
  })

  describe('daily carat pack income', () => {
    it('adds DAILY_CARAT_PACK_PER_DAY × days when daily_carat is true', () => {
      const banner = [makeUmaBanner(1, daysFromNow(30), 0)]
      const { result: withPack } = renderHook(() =>
        useBannerResources({
          userStatsData: { ...zeroStats, daily_carat: true },
          userPlannedBannerData: banner,
          ...noIncome,
        })
      )
      const { result: withoutPack } = renderHook(() =>
        useBannerResources({
          userStatsData: { ...zeroStats, daily_carat: false },
          userPlannedBannerData: banner,
          ...noIncome,
        })
      )
      const diff = withPack.current[0].carats - withoutPack.current[0].carats
      // Both hooks run at the same instant so they see the same day count N.
      // The difference is always an exact whole-day multiple of the pack value.
      expect(diff).toBeGreaterThan(0)
      expect(diff % DAILY_CARAT_PACK_PER_DAY).toBe(0)
    })
  })

  describe('club rank monthly income', () => {
    it('adds club rank income once per calendar month in the window', () => {
      const clubRankWithIncome: ClubRank = { id: 2, name: 'Bronze', income_amount: 1_000 }
      // 50-day window always spans at least one calendar month from today.
      const banner = [makeUmaBanner(1, daysFromNow(50), 0)]
      const { result: withRank } = renderHook(() =>
        useBannerResources({
          userStatsData: { ...zeroStats, club_rank: 2 },
          userPlannedBannerData: banner,
          ...noIncome,
          clubRankData: [noRank, clubRankWithIncome],
        })
      )
      const { result: withoutRank } = renderHook(() =>
        useBannerResources({
          userStatsData: { ...zeroStats, club_rank: 1 },
          userPlannedBannerData: banner,
          ...noIncome,
          clubRankData: [noRank, clubRankWithIncome],
        })
      )
      const diff = withRank.current[0].carats - withoutRank.current[0].carats
      expect(diff).toBeGreaterThanOrEqual(1_000) // at least one month paid
      expect(diff % 1_000).toBe(0)               // always whole-month multiples
    })
  })

  describe('misc earnings (rolling 30-day cycle, toggle-gated)', () => {
    /**
     * Runs one plan twice — misc_earnings on and off — and returns the carat
     * totals for the banner at `index`. Diffing the two isolates misc earnings
     * from every other income source.
     */
    function miscDiff(plan: UserPlannedBanner[], index = plan.length - 1): number {
      const { result: on } = renderHook(() =>
        useBannerResources({
          userStatsData: { ...zeroStats, misc_earnings: true },
          userPlannedBannerData: plan,
          ...noIncome,
        })
      )
      const { result: off } = renderHook(() =>
        useBannerResources({
          userStatsData: { ...zeroStats, misc_earnings: false },
          userPlannedBannerData: plan,
          ...noIncome,
        })
      )
      return on.current[index].carats - off.current[index].carats
    }

    it('credits nothing before the first cycle completes', () => {
      // Day 25 is inside the first 30-day cycle, so no payout has landed yet
      // and the toggle must make no difference at all.
      expect(miscDiff([makeUmaBanner(1, daysFromNow(25), 0)])).toBe(0)
    })

    it('adds one MISC_EARNINGS_PER_CYCLE payout once a full cycle has elapsed', () => {
      // Day 50 clears the day-30 payout; the next one (day 60) is past the end.
      expect(miscDiff([makeUmaBanner(1, daysFromNow(50), 0)])).toBe(
        MISC_EARNINGS_PER_CYCLE
      )
    })

    it('adds one payout per completed cycle over a longer window', () => {
      // Day 80 clears the day-30 and day-60 payouts, but not day 90.
      expect(miscDiff([makeUmaBanner(1, daysFromNow(80), 0)])).toBe(
        MISC_EARNINGS_PER_CYCLE * 2
      )
    })

    it('anchors the cycle to today, so slicing the timeline into more banners does not change the total', () => {
      // The payout schedule is absolute (today+30, today+60, ...), so the total
      // by day 80 must be the same whether the run-up is one window or three.
      // If the cycle restarted at each banner's start, the sliced plan would
      // over-credit.
      const sliced = [
        makeUmaBanner(1, daysFromNow(20), 0),
        makeUmaBanner(2, daysFromNow(45), 0),
        makeUmaBanner(3, daysFromNow(80), 0),
      ]
      expect(miscDiff(sliced)).toBe(miscDiff([makeUmaBanner(1, daysFromNow(80), 0)]))
    })

    it('leaves the non-misc baseline as daily income plus the 50-day login bonus', () => {
      const endStr = daysFromNow(50)
      const { result: off } = renderHook(() =>
        useBannerResources({
          userStatsData: { ...zeroStats, misc_earnings: false },
          userPlannedBannerData: [makeUmaBanner(1, endStr, 0)],
          ...noIncome,
        })
      )
      const today = startOfDay(new Date())
      const end = new Date(endStr)
      const expectedOff =
        calculateDailyIncome(today, end, today) +
        FIFTY_DAY_LOGIN_PER_MONTH * calculateMonthlyOccurrences(today, end)
      expect(off.current[0].carats).toBe(expectedOff)
    })
  })

  describe('50-day login bonus (always on)', () => {
    it('adds FIFTY_DAY_LOGIN_PER_MONTH per month boundary on top of base daily income', () => {
      // With every other source zeroed (ranks 0, daily_carat/misc off, no
      // events, banner ends well before the training-pass launch), the only
      // income is base daily plus the always-on 50-day login bonus — so the
      // total is exact and isolates the constant.
      const endStr = daysFromNow(50)
      const banner = [makeUmaBanner(1, endStr, 0)]
      const { result } = renderHook(() =>
        useBannerResources({
          userStatsData: zeroStats,
          userPlannedBannerData: banner,
          ...noIncome,
        })
      )
      const today = startOfDay(new Date())
      const end = new Date(endStr)
      const expected =
        calculateDailyIncome(today, end, today) +
        FIFTY_DAY_LOGIN_PER_MONTH * calculateMonthlyOccurrences(today, end)
      expect(result.current[0].carats).toBe(expected)
    })
  })

  describe('monthly shop tickets', () => {
    it('credits 3 uma + 4 support tickets per month boundary only when enabled', () => {
      const endStr = daysFromNow(50)
      const banner = [makeUmaBanner(1, endStr, 0)] // 0 pulls so tickets aren't spent
      const shared = { userPlannedBannerData: banner, ...noIncome }
      const { result: on } = renderHook(() =>
        useBannerResources({ userStatsData: { ...zeroStats, monthly_shop_tickets: true }, ...shared })
      )
      const { result: off } = renderHook(() =>
        useBannerResources({ userStatsData: { ...zeroStats, monthly_shop_tickets: false }, ...shared })
      )
      const months = calculateMonthlyOccurrences(startOfDay(new Date()), new Date(endStr))

      expect(off.current[0].umaTickets).toBe(0)
      expect(off.current[0].supportTickets).toBe(0)
      expect(on.current[0].umaTickets).toBe(MONTHLY_SHOP_UMA_TICKETS * months)
      expect(on.current[0].supportTickets).toBe(MONTHLY_SHOP_SUPPORT_TICKETS * months)
    })
  })

  describe('discounted paid pulls', () => {
    // Spend effects only surface on the *next* banner's snapshot (each banner's
    // carats are captured before its own pulls are spent), so these use a second
    // 0-pull banner one day later to read the leftover balance.
    const laterBanner = makeUmaBanner(2, daysFromNow(21), 0)

    it('spends paid carats at the discount rate (50), saving 100 per discounted pull', () => {
      const pulls = 5
      const banners = [makeUmaBanner(1, daysFromNow(20), pulls), laterBanner]
      const stats = { ...zeroStats, current_paid_carat: 500, full_price_paid_pulls: true }
      const { result: on } = renderHook(() =>
        useBannerResources({ userStatsData: { ...stats, discounted_paid_pulls: true }, userPlannedBannerData: banners, ...noIncome })
      )
      const { result: off } = renderHook(() =>
        useBannerResources({ userStatsData: { ...stats, discounted_paid_pulls: false }, userPlannedBannerData: banners, ...noIncome })
      )
      // 5 discounted pulls (day cap 20, paid covers 500/50=10) each save 150-50.
      expect(on.current[1].carats - off.current[1].carats).toBe(
        pulls * (PULL_COST_CARATS - DISCOUNTED_PULL_COST_CARATS)
      )
    })

    it('does nothing when the user has no paid carats', () => {
      const banners = [makeUmaBanner(1, daysFromNow(20), 5), laterBanner]
      const stats = { ...zeroStats, current_paid_carat: 0, full_price_paid_pulls: true }
      const { result: on } = renderHook(() =>
        useBannerResources({ userStatsData: { ...stats, discounted_paid_pulls: true }, userPlannedBannerData: banners, ...noIncome })
      )
      const { result: off } = renderHook(() =>
        useBannerResources({ userStatsData: { ...stats, discounted_paid_pulls: false }, userPlannedBannerData: banners, ...noIncome })
      )
      expect(on.current[1].carats).toBe(off.current[1].carats)
    })

    it('stops discounting once paid carats run out', () => {
      // 120 paid carats only fund floor(120/50) = 2 discounted pulls; the other
      // 3 pulls fall back to full price, so only 2 pulls' worth is saved.
      const banners = [makeUmaBanner(1, daysFromNow(20), 5), laterBanner]
      const stats = { ...zeroStats, current_paid_carat: 120, full_price_paid_pulls: true }
      const { result: on } = renderHook(() =>
        useBannerResources({ userStatsData: { ...stats, discounted_paid_pulls: true }, userPlannedBannerData: banners, ...noIncome })
      )
      const { result: off } = renderHook(() =>
        useBannerResources({ userStatsData: { ...stats, discounted_paid_pulls: false }, userPlannedBannerData: banners, ...noIncome })
      )
      expect(on.current[1].carats - off.current[1].carats).toBe(
        2 * (PULL_COST_CARATS - DISCOUNTED_PULL_COST_CARATS)
      )
    })

    it('caps discounted pulls at one per active day of the banner window', () => {
      // Short window: the day count (not the 5 planned pulls or the 1000/50 = 20
      // paid capacity) is what limits discounts. The banner's active days are
      // derived the same way the hook does (differenceInDays over the window
      // from today) so the assertion is timezone-robust.
      const endStr = daysFromNow(3)
      const banners = [makeUmaBanner(1, endStr, 5), makeUmaBanner(2, daysFromNow(4), 0)]
      const stats = { ...zeroStats, current_paid_carat: 1000, full_price_paid_pulls: true }
      const { result: on } = renderHook(() =>
        useBannerResources({ userStatsData: { ...stats, discounted_paid_pulls: true }, userPlannedBannerData: banners, ...noIncome })
      )
      const { result: off } = renderHook(() =>
        useBannerResources({ userStatsData: { ...stats, discounted_paid_pulls: false }, userPlannedBannerData: banners, ...noIncome })
      )
      const discountDays = Math.max(
        0,
        differenceInDays(new Date(endStr), max([startOfDay(new Date()), new Date(daysFromNow(0))]))
      )
      // The day count is the binding cap here (< 5 pulls, < 20 paid capacity).
      expect(discountDays).toBeGreaterThan(0)
      expect(discountDays).toBeLessThan(5)
      expect(on.current[1].carats - off.current[1].carats).toBe(
        discountDays * (PULL_COST_CARATS - DISCOUNTED_PULL_COST_CARATS)
      )
    })
  })

  describe('max possible pulls reflects the paid-carat strategy', () => {
    it('counts paid carats at full price only when full_price_paid_pulls is on', () => {
      // 300 paid carats = exactly 2 full-price pulls (300 / 150).
      const banner = [makeUmaBanner(1, daysFromNow(1), 0)]
      const stats = { ...zeroStats, current_paid_carat: 300 }
      const { result: on } = renderHook(() =>
        useBannerResources({ userStatsData: { ...stats, full_price_paid_pulls: true }, userPlannedBannerData: banner, ...noIncome })
      )
      const { result: off } = renderHook(() =>
        useBannerResources({ userStatsData: { ...stats, full_price_paid_pulls: false }, userPlannedBannerData: banner, ...noIncome })
      )
      expect(on.current[0].maxPossiblePulls - off.current[0].maxPossiblePulls).toBe(2)
    })

    it('adds discounted pulls to the max when discounted_paid_pulls is on', () => {
      // 100 paid carats = 2 discounted pulls (100 / 50); full price off so paid
      // carats otherwise contribute nothing, isolating the discount's effect.
      const banner = [makeUmaBanner(1, daysFromNow(10), 0)]
      const stats = { ...zeroStats, current_paid_carat: 100, full_price_paid_pulls: false }
      const { result: on } = renderHook(() =>
        useBannerResources({ userStatsData: { ...stats, discounted_paid_pulls: true }, userPlannedBannerData: banner, ...noIncome })
      )
      const { result: off } = renderHook(() =>
        useBannerResources({ userStatsData: { ...stats, discounted_paid_pulls: false }, userPlannedBannerData: banner, ...noIncome })
      )
      expect(on.current[0].maxPossiblePulls - off.current[0].maxPossiblePulls).toBe(2)
    })
  })

  describe('team trials rank weekly income', () => {
    it('adds team trials rank income for each Monday in the window', () => {
      const ttRankWithIncome: TeamTrialsRank = { id: 2, name: 'Bronze', income_amount: 500 }
      // 14-day window always contains at least 2 Mondays.
      const banner = [makeUmaBanner(1, daysFromNow(14), 0)]
      const { result: withRank } = renderHook(() =>
        useBannerResources({
          userStatsData: { ...zeroStats, team_trials_rank: 2 },
          userPlannedBannerData: banner,
          ...noIncome,
          teamTrialsRankData: [noTeamTrialsRank, ttRankWithIncome],
        })
      )
      const { result: withoutRank } = renderHook(() =>
        useBannerResources({
          userStatsData: { ...zeroStats, team_trials_rank: 1 },
          userPlannedBannerData: banner,
          ...noIncome,
          teamTrialsRankData: [noTeamTrialsRank, ttRankWithIncome],
        })
      )
      const diff = withRank.current[0].carats - withoutRank.current[0].carats
      expect(diff).toBeGreaterThanOrEqual(500) // at least one Monday
      expect(diff % 500).toBe(0)               // always whole-Monday multiples
    })
  })

  describe('champions meeting income', () => {
    const cmIncome = 2_000
    const cmRankWithIncome: ChampionsMeetingRank = { id: 2, name: 'Bronze', income_amount: cmIncome, ...zeroRankRewards }

    it('adds champions meeting income when the meeting ends within the banner window', () => {
      const meetingInWindow = makeChampionsMeeting(1, daysFromNow(15))
      const banner = [makeUmaBanner(1, daysFromNow(30), 0)]
      const { result: withMeeting } = renderHook(() =>
        useBannerResources({
          userStatsData: { ...zeroStats, champions_meeting_rank: 2 },
          userPlannedBannerData: banner,
          ...noIncome,
          championsMeetingRankData: [noCmRank, cmRankWithIncome],
          championsMeetingData: [meetingInWindow],
        })
      )
      const { result: withoutMeeting } = renderHook(() =>
        useBannerResources({
          userStatsData: { ...zeroStats, champions_meeting_rank: 2 },
          userPlannedBannerData: banner,
          ...noIncome,
          championsMeetingRankData: [noCmRank, cmRankWithIncome],
          championsMeetingData: [],
        })
      )
      expect(withMeeting.current[0].carats - withoutMeeting.current[0].carats).toBe(cmIncome)
    })

    it('does not add income when the meeting ends after the banner deadline', () => {
      const meetingOutside = makeChampionsMeeting(1, daysFromNow(50))
      const banner = [makeUmaBanner(1, daysFromNow(30), 0)]
      const { result: withMeeting } = renderHook(() =>
        useBannerResources({
          userStatsData: { ...zeroStats, champions_meeting_rank: 2 },
          userPlannedBannerData: banner,
          ...noIncome,
          championsMeetingRankData: [noCmRank, cmRankWithIncome],
          championsMeetingData: [meetingOutside],
        })
      )
      const { result: withoutMeeting } = renderHook(() =>
        useBannerResources({
          userStatsData: { ...zeroStats, champions_meeting_rank: 2 },
          userPlannedBannerData: banner,
          ...noIncome,
          championsMeetingRankData: [noCmRank, cmRankWithIncome],
          championsMeetingData: [],
        })
      )
      expect(withMeeting.current[0].carats).toBe(withoutMeeting.current[0].carats)
    })
  })

  describe('league of heroes income', () => {
    const lohIncome = 1_500
    const lohRankWithIncome: LeagueOfHeroesRank = { id: 2, name: 'Bronze', income_amount: lohIncome, ...zeroRankRewards }

    it('adds league of heroes income when the event ends within the banner window', () => {
      const lohInWindow = makeLeagueOfHeroes(1, daysFromNow(15))
      const banner = [makeUmaBanner(1, daysFromNow(30), 0)]
      const { result: withLoH } = renderHook(() =>
        useBannerResources({
          userStatsData: { ...zeroStats, league_of_heroes_rank: 2 },
          userPlannedBannerData: banner,
          ...noIncome,
          leagueOfHeroesRankData: [noLohRank, lohRankWithIncome],
          leagueOfHeroesData: [lohInWindow],
        })
      )
      const { result: withoutLoH } = renderHook(() =>
        useBannerResources({
          userStatsData: { ...zeroStats, league_of_heroes_rank: 2 },
          userPlannedBannerData: banner,
          ...noIncome,
          leagueOfHeroesRankData: [noLohRank, lohRankWithIncome],
          leagueOfHeroesData: [],
        })
      )
      expect(withLoH.current[0].carats - withoutLoH.current[0].carats).toBe(lohIncome)
    })

    it('does not add income when the event ends after the banner deadline', () => {
      const lohOutside = makeLeagueOfHeroes(1, daysFromNow(50))
      const banner = [makeUmaBanner(1, daysFromNow(30), 0)]
      const { result: withLoH } = renderHook(() =>
        useBannerResources({
          userStatsData: { ...zeroStats, league_of_heroes_rank: 2 },
          userPlannedBannerData: banner,
          ...noIncome,
          leagueOfHeroesRankData: [noLohRank, lohRankWithIncome],
          leagueOfHeroesData: [lohOutside],
        })
      )
      const { result: withoutLoH } = renderHook(() =>
        useBannerResources({
          userStatsData: { ...zeroStats, league_of_heroes_rank: 2 },
          userPlannedBannerData: banner,
          ...noIncome,
          leagueOfHeroesRankData: [noLohRank, lohRankWithIncome],
          leagueOfHeroesData: [],
        })
      )
      expect(withLoH.current[0].carats).toBe(withoutLoH.current[0].carats)
    })
  })

  describe('training pass income', () => {
    // A date one month after the feature launches (Aug 15, 2027).
    // The Aug 24 training pass reward day falls in this window,
    // and the Sep 1 base reward date also falls in it.
    const POST_PASS_DATE = '2027-09-15'
    const PRE_PASS_DATE  = '2027-08-10' // just before the feature launches

    it('adds more carats with training_pass true than false for banners after launch', () => {
      const banner = [makeUmaBanner(1, POST_PASS_DATE, 0)]
      const { result: withPass } = renderHook(() =>
        useBannerResources({
          userStatsData: { ...zeroStats, training_pass: true },
          userPlannedBannerData: banner,
          ...noIncome,
        })
      )
      const { result: withoutPass } = renderHook(() =>
        useBannerResources({
          userStatsData: { ...zeroStats, training_pass: false },
          userPlannedBannerData: banner,
          ...noIncome,
        })
      )
      // Paid pass gives TRAINING_PASS_MONTHLY_REWARD; free tier gives MONTHLY_BASE_REWARD.
      // The paid reward is always larger, so withPass > withoutPass.
      expect(withPass.current[0].carats).toBeGreaterThan(withoutPass.current[0].carats)
    })

    it('adds MONTHLY_BASE_REWARD for banners extending past the launch date', () => {
      // Without training_pass, the base reward still applies after launch.
      // The post-launch result should exceed the pre-launch result (more income).
      const postBanner = [makeUmaBanner(1, POST_PASS_DATE, 0)]
      const preBanner  = [makeUmaBanner(1, PRE_PASS_DATE, 0)]
      const { result: afterLaunch } = renderHook(() =>
        useBannerResources({
          userStatsData: { ...zeroStats, training_pass: false },
          userPlannedBannerData: postBanner,
          ...noIncome,
        })
      )
      const { result: beforeLaunch } = renderHook(() =>
        useBannerResources({
          userStatsData: { ...zeroStats, training_pass: false },
          userPlannedBannerData: preBanner,
          ...noIncome,
        })
      )
      expect(afterLaunch.current[0].carats).toBeGreaterThan(beforeLaunch.current[0].carats)
    })

    it('does not add training pass income for banners ending before the launch date', () => {
      // training_pass true/false must produce identical results before the feature exists.
      const banner = [makeUmaBanner(1, PRE_PASS_DATE, 0)]
      const { result: withPass } = renderHook(() =>
        useBannerResources({
          userStatsData: { ...zeroStats, training_pass: true },
          userPlannedBannerData: banner,
          ...noIncome,
        })
      )
      const { result: withoutPass } = renderHook(() =>
        useBannerResources({
          userStatsData: { ...zeroStats, training_pass: false },
          userPlannedBannerData: banner,
          ...noIncome,
        })
      )
      expect(withPass.current[0].carats).toBe(withoutPass.current[0].carats)
    })
  })

  describe('free pulls', () => {
    it('subtracts free pulls before charging carats or tickets', () => {
      // 5 planned pulls, 3 free → only 2 pulls cost carats.
      // Compare with 0 free pulls (5 pulls cost carats) to isolate the saving.
      const makeBanners = (freePulls: number) => [
        makeUmaBanner(1, daysFromNow(1), 5, freePulls),
        makeUmaBanner(2, daysFromNow(2), 0),
      ]
      const { result: withFree } = renderHook(() =>
        useBannerResources({
          userStatsData: zeroStats,
          userPlannedBannerData: makeBanners(3),
          ...noIncome,
        })
      )
      const { result: noFree } = renderHook(() =>
        useBannerResources({
          userStatsData: zeroStats,
          userPlannedBannerData: makeBanners(0),
          ...noIncome,
        })
      )
      // 3 fewer pulls charged at PULL_COST_CARATS each.
      expect(withFree.current[1].carats - noFree.current[1].carats).toBe(3 * PULL_COST_CARATS)
    })

    it('never charges carats when free pulls cover all planned pulls', () => {
      // 5 planned pulls, 5 free → 0 carats spent.
      const { result } = renderHook(() =>
        useBannerResources({
          userStatsData: { ...zeroStats, current_carat: 10_000 },
          userPlannedBannerData: [
            makeUmaBanner(1, daysFromNow(1), 5, 5),
            makeUmaBanner(2, daysFromNow(2), 0),
          ],
          ...noIncome,
        })
      )
      expect(result.current[1].carats).toBeGreaterThanOrEqual(10_000)
    })
  })

  describe('event reward filtering (additional)', () => {
    it('adds support ticket rewards within the banner window', () => {
      const event: GameEvent = {
        ...makeGameEvent(1, daysFromNow(10), daysFromNow(10), 0),
        support_ticket_amount: 3,
      }
      const { result } = renderHook(() =>
        useBannerResources({
          userStatsData: zeroStats,
          userPlannedBannerData: [makeUmaBanner(1, daysFromNow(30), 0)],
          ...noIncome,
          gameEventsData: [event],
        })
      )
      expect(result.current[0].supportTickets).toBe(3)
    })
  })

  describe('carats_throughout distribution', () => {
    it('adds the full carats_throughout amount when the event span is entirely within the banner window', () => {
      // Event runs day 1–11 (10-day span, 1000 carats). Banner window (now, day30]
      // starts before the event and ends after it, so the full amount is earned.
      const event = makeGameEvent(1, daysFromNow(1), daysFromNow(11), 0, 1_000)
      const { result: withEvent } = renderHook(() =>
        useBannerResources({
          userStatsData: zeroStats,
          userPlannedBannerData: [makeUmaBanner(1, daysFromNow(30), 0)],
          ...noIncome,
          gameEventsData: [event],
        })
      )
      const { result: withoutEvent } = renderHook(() =>
        useBannerResources({
          userStatsData: zeroStats,
          userPlannedBannerData: [makeUmaBanner(1, daysFromNow(30), 0)],
          ...noIncome,
          gameEventsData: [],
        })
      )
      expect(withEvent.current[0].carats - withoutEvent.current[0].carats).toBe(1_000)
    })

    it('front-loads more of the split onto the earlier banner when the event spans a banner boundary', () => {
      // Event runs day 5–15 (10-day span, 1000 carats). Banner 1 ends day 10
      // (the event's midpoint, fraction=0.5) -- the decay curve credits 60%
      // of the pool by the midpoint (not an even 50/50 split like a flat
      // rate would give), because early accrual is front-loaded.
      // Banner 2 ends day 20 (covers the remaining 40%).
      const event = makeGameEvent(1, daysFromNow(5), daysFromNow(15), 0, 1_000)
      const banners = [
        makeUmaBanner(1, daysFromNow(10), 0),
        makeUmaBanner(2, daysFromNow(20), 0),
      ]
      const { result: withEvent } = renderHook(() =>
        useBannerResources({
          userStatsData: zeroStats,
          userPlannedBannerData: banners,
          ...noIncome,
          gameEventsData: [event],
        })
      )
      const { result: withoutEvent } = renderHook(() =>
        useBannerResources({
          userStatsData: zeroStats,
          userPlannedBannerData: banners,
          ...noIncome,
          gameEventsData: [],
        })
      )
      // Banner 1 earns 60% of the event's pool by its midpoint.
      expect(withEvent.current[0].carats - withoutEvent.current[0].carats).toBe(600)
      // Banner 2's cumulative total picks up the remaining 40% (carried over, not doubled).
      expect(withEvent.current[1].carats - withoutEvent.current[1].carats).toBe(1_000)
    })

    it('contributes 0 when the event has unresolved (null) dates', () => {
      const event: GameEvent = {
        ...makeGameEvent(1, daysFromNow(5), daysFromNow(15), 0, 1_000),
        start_date: null,
        end_date: null,
      }
      const { result: withEvent } = renderHook(() =>
        useBannerResources({
          userStatsData: zeroStats,
          userPlannedBannerData: [makeUmaBanner(1, daysFromNow(30), 0)],
          ...noIncome,
          gameEventsData: [event],
        })
      )
      const { result: withoutEvent } = renderHook(() =>
        useBannerResources({
          userStatsData: zeroStats,
          userPlannedBannerData: [makeUmaBanner(1, daysFromNow(30), 0)],
          ...noIncome,
          gameEventsData: [],
        })
      )
      expect(() => withEvent).not.toThrow()
      expect(withEvent.current[0].carats).toBe(withoutEvent.current[0].carats)
    })

    it('only projects the remaining share of an event already in progress', () => {
      // Event started 5 days ago and ends 5 days from now (10-day span, 1000 carats).
      // The banner window starts "now", partway through the event, so only the
      // remaining (not yet elapsed) share should be projected -- strictly less
      // than the full 1000, but still more than 0 since 5 days remain.
      // (With the front-loaded decay curve this comes out to ~400, down from
      // the ~500 a flat rate would give at this same 50%-elapsed point --
      // front-loading means more than half the pool is already "spent" by
      // the midpoint, so less remains for later windows.)
      const event = makeGameEvent(1, daysFromNow(-5), daysFromNow(5), 0, 1_000)
      const { result: withEvent } = renderHook(() =>
        useBannerResources({
          userStatsData: zeroStats,
          userPlannedBannerData: [makeUmaBanner(1, daysFromNow(30), 0)],
          ...noIncome,
          gameEventsData: [event],
        })
      )
      const { result: withoutEvent } = renderHook(() =>
        useBannerResources({
          userStatsData: zeroStats,
          userPlannedBannerData: [makeUmaBanner(1, daysFromNow(30), 0)],
          ...noIncome,
          gameEventsData: [],
        })
      )
      const diff = withEvent.current[0].carats - withoutEvent.current[0].carats
      expect(diff).toBeGreaterThan(0)
      expect(diff).toBeLessThan(1_000)
    })

    it('sums carat_amount and carats_throughout on the same event', () => {
      // Event has both an immediate 200-carat lump (on start_date) and a
      // 1000-carat throughout amount fully inside the banner window.
      const event = makeGameEvent(1, daysFromNow(5), daysFromNow(15), 200, 1_000)
      const { result: withEvent } = renderHook(() =>
        useBannerResources({
          userStatsData: zeroStats,
          userPlannedBannerData: [makeUmaBanner(1, daysFromNow(30), 0)],
          ...noIncome,
          gameEventsData: [event],
        })
      )
      const { result: withoutEvent } = renderHook(() =>
        useBannerResources({
          userStatsData: zeroStats,
          userPlannedBannerData: [makeUmaBanner(1, daysFromNow(30), 0)],
          ...noIncome,
          gameEventsData: [],
        })
      )
      expect(withEvent.current[0].carats - withoutEvent.current[0].carats).toBe(1_200)
    })

    it('front-loads more than a flat rate would credit early in the event', () => {
      // Event runs day 5–15 (10-day span, 1000 carats). Banner 1 ends day 7,
      // just 2 of the event's 10 days in (fraction=0.2) -- a flat rate would
      // credit 20% (200 carats) by this point, but the decay curve credits
      // 36% (360), proving early accrual is front-loaded.
      const event = makeGameEvent(1, daysFromNow(5), daysFromNow(15), 0, 1_000)
      const banners = [
        makeUmaBanner(1, daysFromNow(7), 0),
        makeUmaBanner(2, daysFromNow(15), 0),
      ]
      const { result: withEvent } = renderHook(() =>
        useBannerResources({
          userStatsData: zeroStats,
          userPlannedBannerData: banners,
          ...noIncome,
          gameEventsData: [event],
        })
      )
      const { result: withoutEvent } = renderHook(() =>
        useBannerResources({
          userStatsData: zeroStats,
          userPlannedBannerData: banners,
          ...noIncome,
          gameEventsData: [],
        })
      )
      expect(withEvent.current[0].carats - withoutEvent.current[0].carats).toBeCloseTo(360, 5)
      // Cumulative total by the event's true end is still the full pool.
      expect(withEvent.current[1].carats - withoutEvent.current[1].carats).toBe(1_000)
    })

    it('still credits carats on the last day of the event -- no dead zone before end_date', () => {
      // Same event (day 5–15, 1000 carats). Banner 1 ends day 14 (one day
      // before the event's true end), banner 2 ends day 15 (the true end).
      // Banner 2's own marginal contribution is the last day's worth of
      // carats -- it must be strictly positive, proving accrual doesn't stop
      // early the way the original (incorrect) offset-based reading would have.
      const event = makeGameEvent(1, daysFromNow(5), daysFromNow(15), 0, 1_000)
      const banners = [
        makeUmaBanner(1, daysFromNow(14), 0),
        makeUmaBanner(2, daysFromNow(15), 0),
      ]
      const { result: withEvent } = renderHook(() =>
        useBannerResources({
          userStatsData: zeroStats,
          userPlannedBannerData: banners,
          ...noIncome,
          gameEventsData: [event],
        })
      )
      const { result: withoutEvent } = renderHook(() =>
        useBannerResources({
          userStatsData: zeroStats,
          userPlannedBannerData: banners,
          ...noIncome,
          gameEventsData: [],
        })
      )
      const banner1Diff = withEvent.current[0].carats - withoutEvent.current[0].carats
      const banner2Diff = withEvent.current[1].carats - withoutEvent.current[1].carats
      const lastDayMarginal = banner2Diff - banner1Diff
      expect(lastDayMarginal).toBeCloseTo(80, 5)
      expect(lastDayMarginal).toBeGreaterThan(0)
    })

    it('never credits negative carats when a nested banner ends before the running cutoff', () => {
      // Banner 1 is a long-running banner ending day 30. Banner 2 is nested
      // inside it (starts later but ends sooner, day 10) -- a realistic
      // overlapping-banner scenario. Because lastEndDate only ever advances
      // forward (never retreats to banner 2's earlier end), banner 2's own
      // window is "backwards" (windowStart=day30 > windowEnd=day10). Since
      // remainingShare is non-increasing, this would subtract carats without
      // the outer Math.max(0, ...) guard in getThroughoutCaratsInWindow.
      const event = makeGameEvent(1, daysFromNow(5), daysFromNow(20), 0, 1_000)
      const banners = [
        makeUmaBanner(1, daysFromNow(30), 0),
        makeUmaBanner(2, daysFromNow(10), 0),
      ]
      const { result: withEvent } = renderHook(() =>
        useBannerResources({
          userStatsData: zeroStats,
          userPlannedBannerData: banners,
          ...noIncome,
          gameEventsData: [event],
        })
      )
      const { result: withoutEvent } = renderHook(() =>
        useBannerResources({
          userStatsData: zeroStats,
          userPlannedBannerData: banners,
          ...noIncome,
          gameEventsData: [],
        })
      )
      // Banner 1's window (now, day30] fully contains the event's span.
      expect(withEvent.current[0].carats - withoutEvent.current[0].carats).toBe(1_000)
      // Banner 2 contributes nothing further (not a negative amount) --
      // the cumulative total stays at the full pool, never exceeding it.
      expect(withEvent.current[1].carats - withoutEvent.current[1].carats).toBe(1_000)
    })
  })

  describe('banner count invariance (no shared-boundary double-count)', () => {
    // Regression guard for the bug where each banner's income window was
    // inclusive of BOTH endpoints, so the day two adjacent banners share (one
    // banner's end = the next banner's start) was counted twice. That made
    // adding a banner inflate every downstream total by ~a day's income, and
    // removing one deflate it. Income windows are now half-open (start, end],
    // so totals must not depend on how many banners the timeline is sliced into.

    it('inserting a zero-pull banner in the middle does not change the final banner total', () => {
      // daily_carat on so a double-counted boundary day would be very visible
      // (base income + pack), plus non-zero ranks so Monday/month boundaries
      // would also surface any double-count.
      const stats: UserStats = {
        ...zeroStats,
        daily_carat: true,
        club_rank: 2,
        team_trials_rank: 2,
      }
      const incomeRanks = {
        ...noIncome,
        clubRankData: [noRank, { id: 2, name: 'Silver', income_amount: 3_000 }],
        teamTrialsRankData: [noTeamTrialsRank, { id: 2, name: 'Silver', income_amount: 700 }],
      }

      const withoutMiddle = renderHook(() =>
        useBannerResources({
          userStatsData: stats,
          userPlannedBannerData: [
            makeUmaBanner(1, daysFromNow(10), 0),
            makeUmaBanner(3, daysFromNow(30), 0),
          ],
          ...incomeRanks,
        })
      )
      const withMiddle = renderHook(() =>
        useBannerResources({
          userStatsData: stats,
          userPlannedBannerData: [
            makeUmaBanner(1, daysFromNow(10), 0),
            makeUmaBanner(2, daysFromNow(20), 0), // inserted, spends nothing
            makeUmaBanner(3, daysFromNow(30), 0),
          ],
          ...incomeRanks,
        })
      )

      // The day-30 banner is last in both configs. Since the inserted banner
      // pulls 0 (spends nothing), the day-30 total must be identical.
      const lastWithout = withoutMiddle.result.current.at(-1)!.carats
      const lastWith = withMiddle.result.current.at(-1)!.carats
      expect(lastWith).toBe(lastWithout)

      // The day-10 banner is computed first and unaffected by later banners.
      expect(withMiddle.result.current[0].carats).toBe(withoutMiddle.result.current[0].carats)
    })

    it('splitting one window into two contiguous windows yields the same end total', () => {
      // One banner ending day 20 vs. two banners ending day 10 and day 20.
      // The shared day-10 boundary must not be counted twice.
      const stats: UserStats = { ...zeroStats, daily_carat: true }

      const oneWindow = renderHook(() =>
        useBannerResources({
          userStatsData: stats,
          userPlannedBannerData: [makeUmaBanner(1, daysFromNow(20), 0)],
          ...noIncome,
        })
      )
      const twoWindows = renderHook(() =>
        useBannerResources({
          userStatsData: stats,
          userPlannedBannerData: [
            makeUmaBanner(1, daysFromNow(10), 0),
            makeUmaBanner(2, daysFromNow(20), 0),
          ],
          ...noIncome,
        })
      )

      expect(twoWindows.result.current.at(-1)!.carats).toBe(
        oneWindow.result.current[0].carats
      )
    })
  })
})
