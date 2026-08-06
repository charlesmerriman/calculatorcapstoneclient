import { renderHook } from '@testing-library/react'
import { differenceInDays, startOfDay } from 'date-fns'
import { useBannerResources } from '../hooks/useBannerResources'
import {
  DAILY_CARAT_PACK_PER_DAY,
  DAILY_CARAT_PACK_PAID_CARATS,
  PULL_COST_CARATS,
  DISCOUNTED_PULL_COST_CARATS,
  MISC_EARNINGS_PER_DAY,
  MISC_EARNINGS_DELAY_DAYS,
  FIFTY_DAY_LOGIN_PER_CYCLE,
  FIFTY_DAY_LOGIN_CYCLE_DAYS,
  VALENTINES_CARATS,
  VALENTINES_MONTH,
  VALENTINES_DAY,
  WHITE_DAY_CARATS,
  WHITE_DAY_MONTH,
  WHITE_DAY_DAY,
  MONTHLY_SHOP_UMA_TICKETS,
  MONTHLY_SHOP_SUPPORT_TICKETS,
  TRAINING_PASS_START_DATE,
  TRAINING_PASS_REWARD_DAY,
  TRAINING_PASS_MONTHLY_REWARD,
  MONTHLY_BASE_REWARD,
  TRAINING_PASS_FREE_UMA_TICKETS,
  TRAINING_PASS_FREE_SUPPORT_TICKETS,
  TRAINING_PASS_PAID_BONUS_UMA_TICKETS,
  TRAINING_PASS_PAID_BONUS_SUPPORT_TICKETS,
} from '../constants/gameConstants'
import {
  calculateDailyIncome,
  calculateMonthlyOccurrences,
  calculateDayOfMonthOccurrences,
  calculateIntervalOccurrences,
  calculateAnnualDateOccurrences,
  countDaysAfterDelay,
  getTrainingPassIncome,
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

/**
 * The always-on annual gifts (Valentine's, White Day) earned in a window — the
 * part of the baseline that depends on fixed calendar dates rather than day
 * offsets. Split out because the gift-specific tests need to strip the *other*
 * gift from their totals, which would otherwise mean re-deriving it inline.
 */
function annualGifts(today: Date, end: Date): number {
  return (
    VALENTINES_CARATS *
      calculateAnnualDateOccurrences(today, end, VALENTINES_MONTH, VALENTINES_DAY) +
    WHITE_DAY_CARATS *
      calculateAnnualDateOccurrences(today, end, WHITE_DAY_MONTH, WHITE_DAY_DAY)
  )
}

/**
 * Carats a projection earns regardless of the user's toggles: base daily income
 * plus the universal bonuses (50-day login campaign, Valentine's and White Day
 * gifts).
 *
 * Tests that isolate a single income source build their expectation as this
 * baseline plus the one term under test. Centralising it means adding another
 * always-on income later is a one-line change here rather than an edit to every
 * exact-total assertion in the file.
 */
function alwaysOnBaseline(today: Date, end: Date): number {
  return (
    calculateDailyIncome(today, end, today) +
    FIFTY_DAY_LOGIN_PER_CYCLE *
      calculateIntervalOccurrences(today, end, today, FIFTY_DAY_LOGIN_CYCLE_DAYS) +
    annualGifts(today, end)
  )
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

    it('exposes the two balances separately, still summing to `carats`', () => {
      // The row shows free and paid in their own boxes, so the split has to
      // survive to the snapshot — but it must not disagree with the total.
      const { result } = renderHook(() =>
        useBannerResources({
          userStatsData: { ...zeroStats, current_carat: 3_000, current_paid_carat: 2_000 },
          userPlannedBannerData: [makeUmaBanner(1, daysFromNow(1), 0)],
          ...noIncome,
        })
      )
      const snapshot = result.current[0]
      expect(snapshot.paidCarats).toBe(2_000) // no income source credits paid here
      expect(snapshot.freeCarats + snapshot.paidCarats).toBe(snapshot.carats)
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
    /**
     * Runs one plan twice — daily_carat on and off — and returns the difference
     * in total carats for the banner at `index`, isolating the pack from every
     * other income source. `extraStats` lets a test flip the pull-strategy
     * toggles without disturbing the rest of the baseline.
     */
    function packDiff(
      plan: UserPlannedBanner[],
      extraStats: Partial<UserStats> = {},
      index = plan.length - 1
    ): number {
      const { result: on } = renderHook(() =>
        useBannerResources({
          userStatsData: { ...zeroStats, ...extraStats, daily_carat: true },
          userPlannedBannerData: plan,
          ...noIncome,
        })
      )
      const { result: off } = renderHook(() =>
        useBannerResources({
          userStatsData: { ...zeroStats, ...extraStats, daily_carat: false },
          userPlannedBannerData: plan,
          ...noIncome,
        })
      )
      return on.current[index].carats - off.current[index].carats
    }

    /** Day count the hook itself would compute for a window from today. */
    function daysUntil(endStr: string): number {
      return differenceInDays(new Date(endStr), startOfDay(new Date()))
    }

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

    it('credits no repurchase carats before the first 30-day cycle completes', () => {
      // Day 25 is inside the first cycle, so the only pack income is the daily
      // drip — the 500 lump has not landed yet.
      const endStr = daysFromNow(25)
      expect(packDiff([makeUmaBanner(1, endStr, 0)])).toBe(
        DAILY_CARAT_PACK_PER_DAY * daysUntil(endStr)
      )
    })

    it('adds one 500-carat repurchase per completed 30-day cycle', () => {
      // Day 50 clears the day-30 repurchase; day 60 is past the end.
      const oneCycle = daysFromNow(50)
      expect(packDiff([makeUmaBanner(1, oneCycle, 0)])).toBe(
        DAILY_CARAT_PACK_PER_DAY * daysUntil(oneCycle) + DAILY_CARAT_PACK_PAID_CARATS
      )

      // Day 80 clears day-30 and day-60, but not day 90.
      const twoCycles = daysFromNow(80)
      expect(packDiff([makeUmaBanner(1, twoCycles, 0)])).toBe(
        DAILY_CARAT_PACK_PER_DAY * daysUntil(twoCycles) + DAILY_CARAT_PACK_PAID_CARATS * 2
      )
    })

    it('anchors the repurchase cycle to today, so slicing the timeline does not change the total', () => {
      // Same absolute payout schedule (today+30, today+60, ...) regardless of
      // how many windows the run-up to day 80 is chopped into. If the cycle
      // restarted per banner, the sliced plan would over-credit.
      const sliced = [
        makeUmaBanner(1, daysFromNow(20), 0),
        makeUmaBanner(2, daysFromNow(45), 0),
        makeUmaBanner(3, daysFromNow(80), 0),
      ]
      expect(packDiff(sliced)).toBe(packDiff([makeUmaBanner(1, daysFromNow(80), 0)]))
    })

    it('credits the repurchase lump as PAID carats, so it can fund discounted pulls', () => {
      // Both runs have the pack on, differing only in discounted_paid_pulls,
      // with full-price paid pulls off so paid carats contribute nothing else.
      // A day-50 window banks exactly one 500-carat repurchase = 10 discounted
      // pulls (well under the 50-day discount cap). Were the 500 credited as
      // free carats instead, the discount toggle would make no difference here.
      const banner = [makeUmaBanner(1, daysFromNow(50), 0)]
      const stats = { ...zeroStats, daily_carat: true, full_price_paid_pulls: false }
      const { result: on } = renderHook(() =>
        useBannerResources({
          userStatsData: { ...stats, discounted_paid_pulls: true },
          userPlannedBannerData: banner,
          ...noIncome,
        })
      )
      const { result: off } = renderHook(() =>
        useBannerResources({
          userStatsData: { ...stats, discounted_paid_pulls: false },
          userPlannedBannerData: banner,
          ...noIncome,
        })
      )
      expect(on.current[0].maxPossiblePulls - off.current[0].maxPossiblePulls).toBe(
        DAILY_CARAT_PACK_PAID_CARATS / DISCOUNTED_PULL_COST_CARATS
      )
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

  describe('misc earnings (daily drip after a 30-day ramp-in, toggle-gated)', () => {
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

    it('credits nothing during the ramp-in', () => {
      // Day 25 is inside the 30-day ramp-in, so nothing has accrued yet and the
      // toggle must make no difference at all.
      expect(miscDiff([makeUmaBanner(1, daysFromNow(25), 0)])).toBe(0)
    })

    it('credits MISC_EARNINGS_PER_DAY for every day past the ramp-in', () => {
      // Asserted against the day count the projection's own window arithmetic
      // produces rather than a hard-coded number: daysFromNow() returns a UTC
      // midnight, so exactly which local day a horizon lands on depends on the
      // runner's timezone. The RATE and the RAMP-IN are what these pin down.
      const endStr = daysFromNow(80)
      const today = startOfDay(new Date())
      const drippingDays = countDaysAfterDelay(
        today,
        new Date(endStr),
        today,
        MISC_EARNINGS_DELAY_DAYS
      )
      expect(drippingDays).toBeGreaterThan(45) // sanity: the ramp-in is long past

      expect(miscDiff([makeUmaBanner(1, endStr, 0)])).toBe(
        MISC_EARNINGS_PER_DAY * drippingDays
      )
    })

    it('accrues smoothly — one extra day is worth exactly MISC_EARNINGS_PER_DAY', () => {
      // The regression guard for the change away from 1,800-per-30-days. Under
      // the lump model these three consecutive horizons differed by 0, 0 and
      // 1,800 depending on where the cycle boundary fell; a plan tuned either
      // side of a boundary read very differently for no real reason.
      const day60 = miscDiff([makeUmaBanner(1, daysFromNow(60), 0)])
      const day61 = miscDiff([makeUmaBanner(1, daysFromNow(61), 0)])
      const day62 = miscDiff([makeUmaBanner(1, daysFromNow(62), 0)])

      expect(day61 - day60).toBe(MISC_EARNINGS_PER_DAY)
      expect(day62 - day61).toBe(MISC_EARNINGS_PER_DAY)
    })

    it('anchors the ramp-in to today, so slicing the timeline into more banners does not change the total', () => {
      // The drip's start instant is absolute (today+30), so the total by day 80
      // must be the same whether the run-up is one window or three. If the
      // ramp-in restarted at each banner's start, the sliced plan would
      // under-credit.
      const sliced = [
        makeUmaBanner(1, daysFromNow(20), 0),
        makeUmaBanner(2, daysFromNow(45), 0),
        makeUmaBanner(3, daysFromNow(80), 0),
      ]
      expect(miscDiff(sliced)).toBe(miscDiff([makeUmaBanner(1, daysFromNow(80), 0)]))
    })

    it('leaves the non-misc baseline as daily income plus the always-on bonuses', () => {
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
      expect(off.current[0].carats).toBe(alwaysOnBaseline(today, end))
    })
  })

  describe('50-day login bonus (always on)', () => {
    // The campaign runs on a rolling 50-day cycle anchored to today, NOT on
    // calendar-month boundaries — so these assert against day offsets.
    const loginDiff = (endStr: string) => {
      const { result } = renderHook(() =>
        useBannerResources({
          userStatsData: zeroStats,
          userPlannedBannerData: [makeUmaBanner(1, endStr, 0)],
          ...noIncome,
        })
      )
      const today = startOfDay(new Date())
      const end = new Date(endStr)
      // Strip the rest of the always-on baseline so only the login term is left.
      return (
        result.current[0].carats -
        calculateDailyIncome(today, end, today) -
        annualGifts(today, end)
      )
    }

    // NOTE: daysFromNow() yields an ISO date string, which parses as UTC
    // midnight, while the projection anchors to LOCAL midnight. In a negative
    // UTC offset the two differ by hours, so an assertion sitting exactly on a
    // payout day can fall either side of the window edge. These offsets are
    // therefore kept clear of the day-50/100/150 boundaries.

    it('credits nothing before the first cycle completes', () => {
      // Day 45 is inside the first cycle — the day-50 payout has not landed.
      expect(loginDiff(daysFromNow(45))).toBe(0)
    })

    it('credits one payout once a full 50-day cycle has elapsed', () => {
      expect(loginDiff(daysFromNow(55))).toBe(FIFTY_DAY_LOGIN_PER_CYCLE)
    })

    it('credits one payout per completed cycle over a longer window', () => {
      // Day 120 clears the day-50 and day-100 payouts, but not day 150.
      expect(loginDiff(daysFromNow(120))).toBe(FIFTY_DAY_LOGIN_PER_CYCLE * 2)
    })

    it('anchors the cycle to today, so slicing the timeline does not change the total', () => {
      // Payout instants are absolute (today+50, today+100, ...), so three
      // windows summing to day 120 must total the same as one.
      const today = startOfDay(new Date())
      const sliced = [
        makeUmaBanner(1, daysFromNow(30), 0),
        makeUmaBanner(2, daysFromNow(75), 0),
        makeUmaBanner(3, daysFromNow(120), 0),
      ]
      const { result } = renderHook(() =>
        useBannerResources({
          userStatsData: zeroStats,
          userPlannedBannerData: sliced,
          ...noIncome,
        })
      )
      const end = new Date(daysFromNow(120))
      expect(result.current[2].carats).toBe(alwaysOnBaseline(today, end))
    })
  })

  describe('annual gift bonuses (always on)', () => {
    /**
     * Valentine's (Feb 14) and White Day (Mar 14) are fixed calendar dates, so
     * unlike the rolling-cycle incomes these tests can't use day offsets — how
     * far away each date is depends on when the suite runs. Instead they assert
     * the relationship between the projection and calculateAnnualDateOccurrences
     * over the same window, which holds on any run date.
     *
     * Both gifts get the same treatment, so the cases are shared: each one
     * strips the OTHER gift out of the total via annualGifts() minus its own
     * term, which keeps the two from masking each other (crediting White Day
     * twice and Valentine's not at all would still pass a combined assertion).
     */
    const caratsTo = (endStr: string) => {
      const { result } = renderHook(() =>
        useBannerResources({
          userStatsData: zeroStats,
          userPlannedBannerData: [makeUmaBanner(1, endStr, 0)],
          ...noIncome,
        })
      )
      return result.current[0].carats
    }

    const gifts = [
      { label: "Valentine's Day", carats: VALENTINES_CARATS, month: VALENTINES_MONTH, day: VALENTINES_DAY },
      { label: 'White Day', carats: WHITE_DAY_CARATS, month: WHITE_DAY_MONTH, day: WHITE_DAY_DAY },
    ]

    it.each(gifts)('credits $label for each occurrence in the window', ({ carats, month, day }) => {
      // Three years out is guaranteed to span at least two of each gift date
      // whatever today's date is.
      const endStr = daysFromNow(365 * 3)
      const today = startOfDay(new Date())
      const end = new Date(endStr)
      const occurrences = calculateAnnualDateOccurrences(today, end, month, day)
      expect(occurrences).toBeGreaterThanOrEqual(2)

      // Strip every other income the window picks up — including the sibling
      // gift — so only this gift's term remains. A window this long reaches past
      // TRAINING_PASS_START_DATE, so the free-tier pass contributes too;
      // computed with the same helper the hook uses rather than re-deriving its
      // month math here.
      const otherGifts =
        annualGifts(today, end) - carats * occurrences

      const giftOnly =
        caratsTo(endStr) -
        calculateDailyIncome(today, end, today) -
        FIFTY_DAY_LOGIN_PER_CYCLE *
          calculateIntervalOccurrences(today, end, today, FIFTY_DAY_LOGIN_CYCLE_DAYS) -
        getTrainingPassIncome(today, end, false).freeCarats -
        otherGifts

      expect(giftOnly).toBe(carats * occurrences)
    })

    it('credits nothing over a window too short to reach either gift date', () => {
      // A 10-day window can only contain Feb 14 or Mar 14 if today is within 10
      // days of one; skip on those few days rather than assert something false.
      const endStr = daysFromNow(10)
      const today = startOfDay(new Date())
      const end = new Date(endStr)

      if (annualGifts(today, end) === 0) {
        expect(caratsTo(endStr)).toBe(calculateDailyIncome(today, end, today))
      }
    })
  })

  describe('monthly shop tickets', () => {
    it('credits 4 uma + 4 support tickets per month boundary only when enabled', () => {
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

    it('caps discounted pulls at one per day of the banner window', () => {
      // Short window: the day count (not the 5 planned pulls or the 1000/50 = 20
      // paid capacity) is what limits discounts. The banner's days are derived
      // the same way the hook does — inclusive calendar days across the whole
      // window — so the assertion is timezone-robust.
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
        differenceInDays(
          startOfDay(new Date(endStr)),
          startOfDay(new Date(daysFromNow(0))) // makeUmaBanner's window start
        ) + 1
      )
      // The day count is the binding cap here (< 5 pulls, < 20 paid capacity).
      expect(discountDays).toBeGreaterThan(0)
      expect(discountDays).toBeLessThan(5)
      expect(on.current[1].carats - off.current[1].carats).toBe(
        discountDays * (PULL_COST_CARATS - DISCOUNTED_PULL_COST_CARATS)
      )
    })

    it('counts the opening and closing days of a real banner window', () => {
      // Regression for the off-by-2 day cap. Real banner windows run
      // `<start>T22:00:00Z` -> `<end>T21:59:59Z`; this one spans 13 calendar
      // days (the 10th through the 22nd), so it must allow 13 discounted pulls.
      // The old bare `differenceInDays(end, start)` returned 11: it counted the
      // gaps between days rather than the days, then truncated again because
      // the window is one second short of a whole number of days.
      //
      // Both endpoints carry the same UTC offset, so the number of local
      // calendar days they span is the same in every timezone.
      const start = new Date()
      start.setDate(start.getDate() + 30)
      const startStr = `${start.toISOString().split('T')[0]}T22:00:00Z`
      const end = new Date(start)
      end.setDate(end.getDate() + 12)
      const endStr = `${end.toISOString().split('T')[0]}T21:59:59Z`

      const banner = makeUmaBanner(1, endStr, 0)
      banner.banner_uma!.banner_timeline.start_date = startStr
      banner.banner_uma!.banner_timeline.global_start_date = startStr

      // Toggling the discount on/off cancels the universal daily income both
      // runs share (it is not part of `noIncome`), so the difference is purely
      // the discounted pulls. Paid carats are deliberately generous — 2,000
      // funds 40 discounts — so the DAY CAP is the binding limit, and the
      // assertion fails on an over-count as well as an under-count.
      const stats = { ...zeroStats, current_paid_carat: 2_000, full_price_paid_pulls: false }
      const { result: on } = renderHook(() =>
        useBannerResources({ userStatsData: { ...stats, discounted_paid_pulls: true }, userPlannedBannerData: [banner], ...noIncome })
      )
      const { result: off } = renderHook(() =>
        useBannerResources({ userStatsData: { ...stats, discounted_paid_pulls: false }, userPlannedBannerData: [banner], ...noIncome })
      )
      expect(on.current[0].maxPossiblePulls - off.current[0].maxPossiblePulls).toBe(13)
    })

    it('counts the full window of a banner that has already started', () => {
      // Regression for the shrinking cap. The allowance used to be measured
      // from TODAY, so a live banner lost one discounted pull per elapsed day
      // and the user had to keep re-tuning pull counts mid-banner. This window
      // opened 5 days ago and closes 4 days from now — 10 inclusive calendar
      // days — and all 10 must count even though half have already passed.
      //
      // Both endpoints carry the same UTC offset, so the number of local
      // calendar days they span is the same in every timezone.
      const start = new Date()
      start.setDate(start.getDate() - 5)
      const startStr = `${start.toISOString().split('T')[0]}T22:00:00Z`
      const end = new Date(start)
      end.setDate(end.getDate() + 9)
      const endStr = `${end.toISOString().split('T')[0]}T21:59:59Z`

      const banner = makeUmaBanner(1, endStr, 0)
      banner.banner_uma!.banner_timeline.start_date = startStr
      banner.banner_uma!.banner_timeline.global_start_date = startStr

      // Same isolation as the test above: full price off plus a paid balance
      // generous enough (2,000 funds 40 discounts) that the DAY CAP is the only
      // binding limit, so the assertion catches an over-count as well as an
      // under-count.
      const stats = { ...zeroStats, current_paid_carat: 2_000, full_price_paid_pulls: false }
      const { result: on } = renderHook(() =>
        useBannerResources({ userStatsData: { ...stats, discounted_paid_pulls: true }, userPlannedBannerData: [banner], ...noIncome })
      )
      const { result: off } = renderHook(() =>
        useBannerResources({ userStatsData: { ...stats, discounted_paid_pulls: false }, userPlannedBannerData: [banner], ...noIncome })
      )
      expect(on.current[0].maxPossiblePulls - off.current[0].maxPossiblePulls).toBe(10)
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

    it('reports the paid tier total across both carat balances', () => {
      // `carats` is the combined free + paid display figure, so splitting the
      // paid tier's reward (1,850 free + 350 paid) must not change what the
      // user sees. This window contains exactly one reward day (Aug 24) and
      // one month boundary (Sep 1), so the gap between the tiers is the plain
      // difference between the two monthly figures.
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

      expect(withPass.current[0].carats - withoutPass.current[0].carats).toBe(
        TRAINING_PASS_MONTHLY_REWARD - MONTHLY_BASE_REWARD
      )
    })

    it('feeds the paid balance, unlocking discounted pulls', () => {
      // zeroStats has no starting paid carats and no Daily Carat Pack, so the
      // pass is the ONLY paid-carat source here. If its 350 lands in the paid
      // balance, turning discounted pulls on must buy more pulls (50 each)
      // than folding the same carats into the 150-carat full-price pool.
      const banner = [makeUmaBanner(1, POST_PASS_DATE, 0)]
      const stats = { ...zeroStats, training_pass: true }

      const { result: discountOn } = renderHook(() =>
        useBannerResources({
          userStatsData: { ...stats, discounted_paid_pulls: true },
          userPlannedBannerData: banner,
          ...noIncome,
        })
      )
      const { result: discountOff } = renderHook(() =>
        useBannerResources({
          userStatsData: { ...stats, discounted_paid_pulls: false },
          userPlannedBannerData: banner,
          ...noIncome,
        })
      )

      expect(discountOn.current[0].maxPossiblePulls).toBeGreaterThan(
        discountOff.current[0].maxPossiblePulls
      )
    })

    it('grants no paid carats on the free tier', () => {
      // The mirror of the test above: without the paid pass there are no paid
      // carats at all, so the discount toggle can have no effect.
      const banner = [makeUmaBanner(1, POST_PASS_DATE, 0)]
      const stats = { ...zeroStats, training_pass: false }

      const { result: discountOn } = renderHook(() =>
        useBannerResources({
          userStatsData: { ...stats, discounted_paid_pulls: true },
          userPlannedBannerData: banner,
          ...noIncome,
        })
      )
      const { result: discountOff } = renderHook(() =>
        useBannerResources({
          userStatsData: { ...stats, discounted_paid_pulls: false },
          userPlannedBannerData: banner,
          ...noIncome,
        })
      )

      expect(discountOn.current[0].maxPossiblePulls).toBe(
        discountOff.current[0].maxPossiblePulls
      )
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

    // Tickets, unlike carats, are base + bonus: the free tier applies to every
    // account after launch and the paid pass stacks its bonus on top. Both land
    // on TRAINING_PASS_REWARD_DAY even for free-tier accounts (whose carats
    // still pay on month boundaries).
    it('credits free-tier tickets on the reward day without a paid pass', () => {
      const banner = [makeUmaBanner(1, POST_PASS_DATE, 0)] // 0 pulls so tickets aren't spent
      const { result } = renderHook(() =>
        useBannerResources({
          userStatsData: { ...zeroStats, training_pass: false },
          userPlannedBannerData: banner,
          ...noIncome,
        })
      )
      const rewardDays = calculateDayOfMonthOccurrences(
        TRAINING_PASS_START_DATE,
        new Date(POST_PASS_DATE),
        TRAINING_PASS_REWARD_DAY
      )

      expect(rewardDays).toBeGreaterThan(0) // guard: the window must contain a payout
      expect(result.current[0].umaTickets).toBe(rewardDays * TRAINING_PASS_FREE_UMA_TICKETS)
      expect(result.current[0].supportTickets).toBe(rewardDays * TRAINING_PASS_FREE_SUPPORT_TICKETS)
    })

    it('stacks the paid bonus tickets on top of the free tier', () => {
      const banner = [makeUmaBanner(1, POST_PASS_DATE, 0)]
      const { result } = renderHook(() =>
        useBannerResources({
          userStatsData: { ...zeroStats, training_pass: true },
          userPlannedBannerData: banner,
          ...noIncome,
        })
      )
      const rewardDays = calculateDayOfMonthOccurrences(
        TRAINING_PASS_START_DATE,
        new Date(POST_PASS_DATE),
        TRAINING_PASS_REWARD_DAY
      )

      expect(result.current[0].umaTickets).toBe(
        rewardDays * (TRAINING_PASS_FREE_UMA_TICKETS + TRAINING_PASS_PAID_BONUS_UMA_TICKETS)
      )
      expect(result.current[0].supportTickets).toBe(
        rewardDays * (TRAINING_PASS_FREE_SUPPORT_TICKETS + TRAINING_PASS_PAID_BONUS_SUPPORT_TICKETS)
      )
    })

    it('credits no tickets for banners ending before the launch date', () => {
      const banner = [makeUmaBanner(1, PRE_PASS_DATE, 0)]
      const { result } = renderHook(() =>
        useBannerResources({
          userStatsData: { ...zeroStats, training_pass: true },
          userPlannedBannerData: banner,
          ...noIncome,
        })
      )
      expect(result.current[0].umaTickets).toBe(0)
      expect(result.current[0].supportTickets).toBe(0)
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

    it('lands the whole pool on ONE banner instead of splitting it across two', () => {
      // Event runs day 5–15, so its BANNER closes day 11 (the API pads an
      // event's end by GAME_EVENT_END_DATE_BUFFER_DAYS). The filter key is
      // day 11 - THROUGHOUT_FILTER_GRACE_DAYS = day 7, so the day-10 banner is
      // the first checkpoint that reaches it and collects the entire pool.
      //
      // The old model prorated the pool across every window it overlapped,
      // which made a banner's estimate depend on how the user had sliced their
      // plan. Banner 2's cumulative total carries the same 1000 forward -- it
      // must not be credited a second time.
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
      expect(withEvent.current[0].carats - withoutEvent.current[0].carats).toBe(1_000)
      expect(withEvent.current[1].carats - withoutEvent.current[1].carats).toBe(1_000)
    })

    it("gives an event the same value however the user slices their plan", () => {
      // The headline property of the new model: an event's contribution is
      // fixed as of today, so adding an unrelated banner in front of it cannot
      // move the number. Under the old proration it could and did.
      const event = makeGameEvent(1, daysFromNow(10), daysFromNow(30), 0, 1_000)
      const render = (banners: ReturnType<typeof makeUmaBanner>[]) =>
        renderHook(() =>
          useBannerResources({
            userStatsData: zeroStats,
            userPlannedBannerData: banners,
            ...noIncome,
            gameEventsData: [event],
          })
        ).result

      const alone = render([makeUmaBanner(1, daysFromNow(40), 0)])
      const sliced = render([
        makeUmaBanner(1, daysFromNow(25), 0),
        makeUmaBanner(2, daysFromNow(40), 0),
      ])

      // Same final balance either way, and the extra banner does not double it.
      expect(sliced.current[1].carats).toBe(alone.current[0].carats)
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
      // Banner ran day -10 to day 6 (event end day 10, minus the 4-day pad), so
      // the curve runs day -10 to day 2 and today sits 10/12 of the way along.
      // The linear leg wins there at 0.8 * (1 - 10/12) = 0.1333, giving 133.3
      // carats, which the sheet's CEILING(..., 10) rounds up to 140.
      //
      // Exact rather than a range: this is the case the whole model turns on
      // (how much a RUNNING event still owes you), and the rounding step only
      // shows up here.
      const event = makeGameEvent(1, daysFromNow(-10), daysFromNow(10), 0, 1_000)
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
      expect(diff).toBe(140)
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

    it('reaches an event whose banner closes just AFTER the checkpoint, within the grace window', () => {
      // The sheet's filter lets a checkpoint pick up banners ending shortly
      // after it ("similar end dates"), worth THROUGHOUT_FILTER_GRACE_DAYS.
      //
      //   near: event ends day 17 -> banner closes day 13 -> key day 9  (<= 10, in reach)
      //   far:  event ends day 20 -> banner closes day 16 -> key day 12 (>  10, out of reach)
      //
      // Both are still in the future, so each contributes its whole pool once
      // a checkpoint reaches it.
      const near = makeGameEvent(1, daysFromNow(5), daysFromNow(17), 0, 1_000)
      const far = makeGameEvent(2, daysFromNow(5), daysFromNow(20), 0, 1_000)
      const banners = [
        makeUmaBanner(1, daysFromNow(10), 0),
        makeUmaBanner(2, daysFromNow(30), 0),
      ]
      const { result: withEvents } = renderHook(() =>
        useBannerResources({
          userStatsData: zeroStats,
          userPlannedBannerData: banners,
          ...noIncome,
          gameEventsData: [near, far],
        })
      )
      const { result: withoutEvents } = renderHook(() =>
        useBannerResources({
          userStatsData: zeroStats,
          userPlannedBannerData: banners,
          ...noIncome,
          gameEventsData: [],
        })
      )
      expect(withEvents.current[0].carats - withoutEvents.current[0].carats).toBe(1_000)
      expect(withEvents.current[1].carats - withoutEvents.current[1].carats).toBe(2_000)
    })

    it('credits nothing for an event whose banner has already closed', () => {
      // Banner ran day -30 to day -6 (event end day -2 minus the pad). Its
      // carats are gone, not bankable, so no checkpoint may pick them up --
      // the sheet's `today <= rowEnd` condition. Note this is about the
      // EVENT's banner being over, not the user's own planned banner.
      const event = makeGameEvent(1, daysFromNow(-30), daysFromNow(-2), 0, 1_000)
      const banners = [makeUmaBanner(1, daysFromNow(30), 0)]
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
      expect(withEvent.current[0].carats - withoutEvent.current[0].carats).toBe(0)
    })

    it('counts every in-flight banner, not just one', () => {
      // Several banners can be running at once and all of them contribute
      // whatever they have left -- there is deliberately no "only the current
      // one" rule. Two identical in-progress events must therefore credit
      // exactly double a single one.
      const one = makeGameEvent(1, daysFromNow(-10), daysFromNow(10), 0, 1_000)
      const two = makeGameEvent(2, daysFromNow(-10), daysFromNow(10), 0, 1_000)
      const banners = [makeUmaBanner(1, daysFromNow(30), 0)]
      const render = (events: GameEvent[]) =>
        renderHook(() =>
          useBannerResources({
            userStatsData: zeroStats,
            userPlannedBannerData: banners,
            ...noIncome,
            gameEventsData: events,
          })
        ).result

      const none = render([])
      const single = render([one])
      const both = render([one, two])

      expect(single.current[0].carats - none.current[0].carats).toBe(140)
      expect(both.current[0].carats - none.current[0].carats).toBe(280)
    })

    it('never credits negative carats for a banner that has already ended', () => {
      // The walk's cursor starts at today and must not retreat behind it, so a
      // planned banner already in the past gets a backwards window. It must
      // collect exactly nothing rather than subtracting from the balance.
      const event = makeGameEvent(1, daysFromNow(-10), daysFromNow(20), 0, 1_000)
      const banners = [
        makeUmaBanner(1, daysFromNow(-5), 0), // already over
        makeUmaBanner(2, daysFromNow(30), 0),
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
      // The passed banner earns exactly nothing extra -- not a negative amount.
      expect(withEvent.current[0].carats - withoutEvent.current[0].carats).toBe(0)
      // The live banner still collects everything left in the pool from today on.
      expect(withEvent.current[1].carats - withoutEvent.current[1].carats).toBeGreaterThan(0)
    })
  })

  describe('walk order (checkpoints follow end dates, results follow display order)', () => {
    // Regression guard for the bug where the calendar walk followed the display
    // list. Rows are sorted by START date on screen, which is not the same
    // ordering as END date whenever a short banner is nested inside a longer
    // one. The walk needs ascending end dates because its cursor is a date that
    // only moves forward; the results still have to land on the right rows.

    it('gives a nested banner the same estimate however it is ordered in the list', () => {
      // The same two banners, listed in both possible orders. Each row's
      // estimate must depend only on its own end date, never on its position.
      const stats: UserStats = { ...zeroStats, daily_carat: true, current_carat: 5_000 }
      const long = makeUmaBanner(1, daysFromNow(30), 0)
      const nested = makeUmaBanner(2, daysFromNow(10), 0)

      const longFirst = renderHook(() =>
        useBannerResources({
          userStatsData: stats,
          userPlannedBannerData: [long, nested],
          ...noIncome,
        })
      )
      const nestedFirst = renderHook(() =>
        useBannerResources({
          userStatsData: stats,
          userPlannedBannerData: [nested, long],
          ...noIncome,
        })
      )

      // longFirst: [long, nested]   nestedFirst: [nested, long]
      expect(longFirst.result.current[0].carats).toBe(nestedFirst.result.current[1].carats)
      expect(longFirst.result.current[1].carats).toBe(nestedFirst.result.current[0].carats)
    })

    it('matches the estimate the nested banner gets on its own', () => {
      // A checkpoint's value must equal what that banner would report as the
      // only row in the plan, since nothing ahead of it spends anything.
      const stats: UserStats = { ...zeroStats, daily_carat: true, current_carat: 5_000 }
      const nested = makeUmaBanner(2, daysFromNow(10), 0)

      const chained = renderHook(() =>
        useBannerResources({
          userStatsData: stats,
          userPlannedBannerData: [makeUmaBanner(1, daysFromNow(30), 0), nested],
          ...noIncome,
        })
      )
      const alone = renderHook(() =>
        useBannerResources({
          userStatsData: stats,
          userPlannedBannerData: [nested],
          ...noIncome,
        })
      )

      expect(chained.result.current[1].carats).toBe(alone.result.current[0].carats)
    })

    it('spends the nested banner first, so the longer banner sees the deduction', () => {
      // Ordering the walk by end date also fixes spend order: money committed
      // to a banner closing on day 10 is gone before the day-30 checkpoint.
      const stats: UserStats = { ...zeroStats, current_carat: 10_000 }
      const long = makeUmaBanner(1, daysFromNow(30), 0)
      const nestedSpending = makeUmaBanner(2, daysFromNow(10), 10) // 10 pulls

      const withSpend = renderHook(() =>
        useBannerResources({
          userStatsData: stats,
          userPlannedBannerData: [long, nestedSpending],
          ...noIncome,
        })
      )
      const withoutSpend = renderHook(() =>
        useBannerResources({
          userStatsData: stats,
          userPlannedBannerData: [long, makeUmaBanner(2, daysFromNow(10), 0)],
          ...noIncome,
        })
      )

      // Index 0 is the day-30 banner in both runs; it now loses the 10 pulls
      // the nested banner committed earlier in the calendar.
      expect(withoutSpend.result.current[0].carats - withSpend.result.current[0].carats).toBe(
        10 * PULL_COST_CARATS
      )
    })

    it('keeps display order for banners that share an end date', () => {
      // Every uma/support pair shares a timeline, so ties are the common case.
      // A stable sort must leave them in list order -- the uma banner keeps
      // spending first, as it did before the walk was reordered.
      const stats: UserStats = { ...zeroStats, current_carat: 10_000 }
      const banners = [
        makeUmaBanner(1, daysFromNow(10), 10), // spends 1,500
        makeSupportBanner(2, daysFromNow(10), 0),
      ]
      const { result } = renderHook(() =>
        useBannerResources({
          userStatsData: stats,
          userPlannedBannerData: banners,
          ...noIncome,
        })
      )

      // The uma banner is checkpointed before its own spend; the support banner
      // shares the same end date so it collects no further income and sees the
      // balance after the uma banner's pulls.
      expect(result.current[0].carats - result.current[1].carats).toBe(10 * PULL_COST_CARATS)
    })
  })

  describe('walk order (same closing day, different closing instants)', () => {
    // Regression guard for the bug where two banners the sheet shows as ending
    // on the SAME DAY spent in the wrong order.
    //
    // Predicted timelines come off the backend as
    // `anchor + jp_gap * PREDICTION_FACTOR`, a float times a timedelta, so each
    // lands on an arbitrary time of day (07:24:28.800Z, 21:59:59Z, ...).
    // formatDate prints local Y/M/D only, so the rows read as one date while
    // their instants sit hours apart. Sorting the walk on the raw instant let a
    // banner that merely drew an earlier time of day spend first and charge its
    // pulls to a banner that had opened weeks earlier.

    /** ISO instant at a given LOCAL time of day, N days out. Unambiguous about
     *  which local calendar day it lands on, unlike the date-only strings the
     *  shared fixtures use. */
    function localInstant(daysAhead: number, hours: number, minutes = 0, seconds = 0): string {
      const d = new Date()
      d.setDate(d.getDate() + daysAhead)
      d.setHours(hours, minutes, seconds, 0)
      return d.toISOString()
    }

    /** Rewrites a fixture banner's timeline dates — the shared makers hardcode
     *  `daysFromNow(0)` as the start, and these cases need distinct starts. */
    function withDates(
      banner: UserPlannedBanner,
      startDate: string,
      endDate: string
    ): UserPlannedBanner {
      const side = banner.banner_uma ?? banner.banner_support!
      const banner_timeline = {
        ...side.banner_timeline,
        start_date: startDate,
        end_date: endDate,
        global_start_date: startDate,
        global_end_date: endDate,
      }
      return banner.banner_uma
        ? { ...banner, banner_uma: { ...banner.banner_uma, banner_timeline } }
        : { ...banner, banner_support: { ...banner.banner_support!, banner_timeline } }
    }

    // Both close on local day 20. `earlyStart` opened on day 0 and closes at
    // 21:59:59; `lateStart` opened on day 10 and closes at 07:24:28 — the
    // earlier INSTANT, which is exactly what used to hand it spend priority.
    const closeLate = localInstant(20, 21, 59, 59)
    const closeEarly = localInstant(20, 7, 24, 28)
    const earlyStart = (pulls: number) =>
      withDates(makeSupportBanner(1, closeLate, pulls), localInstant(0, 12), closeLate)
    const lateStart = (pulls: number) =>
      withDates(makeSupportBanner(2, closeEarly, pulls), localInstant(10, 12), closeEarly)

    const stats: UserStats = { ...zeroStats, current_carat: 200_000 }

    it('does not charge the earlier-starting banner for the later one\'s pulls', () => {
      const withSpend = renderHook(() =>
        useBannerResources({
          userStatsData: stats,
          userPlannedBannerData: [earlyStart(0), lateStart(10)],
          ...noIncome,
        })
      )
      const withoutSpend = renderHook(() =>
        useBannerResources({
          userStatsData: stats,
          userPlannedBannerData: [earlyStart(0), lateStart(0)],
          ...noIncome,
        })
      )

      // Index 0 is the day-0 banner. It is checkpointed first, so the pulls
      // committed to a banner that opened ten days later cannot reach it.
      expect(withSpend.result.current[0].carats).toBe(withoutSpend.result.current[0].carats)
    })

    it('charges the later-starting banner for the earlier one\'s pulls', () => {
      const { result } = renderHook(() =>
        useBannerResources({
          userStatsData: stats,
          userPlannedBannerData: [earlyStart(10), lateStart(0)],
          ...noIncome,
        })
      )

      // The day-0 banner is snapshotted before its own spend; the day-10 banner
      // closes the same day so it collects no further income and sees the
      // balance after those pulls.
      expect(result.current[0].carats - result.current[1].carats).toBe(10 * PULL_COST_CARATS)
    })

    it('spends the earlier-starting banner first whichever order the list is in', () => {
      const asDisplayed = renderHook(() =>
        useBannerResources({
          userStatsData: stats,
          userPlannedBannerData: [earlyStart(10), lateStart(0)],
          ...noIncome,
        })
      )
      const reversed = renderHook(() =>
        useBannerResources({
          userStatsData: stats,
          userPlannedBannerData: [lateStart(0), earlyStart(10)],
          ...noIncome,
        })
      )

      // Same two banners, mirrored positions: each row's estimate must follow
      // its own start date, never its slot in the array.
      expect(reversed.result.current[1].carats).toBe(asDisplayed.result.current[0].carats)
      expect(reversed.result.current[0].carats).toBe(asDisplayed.result.current[1].carats)
    })

    it('never refunds throughout carats when the walk steps back within a day', () => {
      // sumRemainingThroughoutCarats filters on the raw instant, so the
      // second checkpoint of a same-day pair queries a moment ~14h EARLIER than
      // the first. Its running total can only shrink there, and an unclamped
      // delta would subtract carats already credited.
      const throughoutEvent = makeGameEvent(1, localInstant(0, 12), localInstant(20, 12), 0, 6_000)

      const { result } = renderHook(() =>
        useBannerResources({
          userStatsData: stats,
          userPlannedBannerData: [earlyStart(0), lateStart(0)],
          ...noIncome,
          gameEventsData: [throughoutEvent],
        })
      )

      // Neither banner spends, and the second collects nothing new, so the two
      // estimates must match exactly. A negative delta would drag the second
      // below the first.
      expect(result.current[1].carats).toBe(result.current[0].carats)
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

    it('tiles across banner ends that fall at different times of day', () => {
      // The tests above all use daysFromNow(), which yields midnight-aligned
      // boundaries — and differenceInDays happens to tile perfectly when every
      // endpoint shares a time of day, which is why the Daily Carat Pack drift
      // hid here for so long. REAL banner timelines end at ragged instants
      // (21:59:59Z, 17:11:59Z, ...), and differenceInDays truncated each
      // window's leftover hours independently, losing up to a day of pack
      // carats per banner. Adding a banner shaved ~50 carats off every
      // downstream row; deleting one handed them back.
      const stats: UserStats = { ...zeroStats, daily_carat: true }

      const chained = renderHook(() =>
        useBannerResources({
          userStatsData: stats,
          userPlannedBannerData: [
            makeUmaBanner(1, `${daysFromNow(10)}T21:59:59Z`, 0),
            makeUmaBanner(2, `${daysFromNow(14)}T17:11:59Z`, 0),
            makeUmaBanner(3, `${daysFromNow(20)}T07:35:59Z`, 0),
          ],
          ...noIncome,
        })
      )
      const single = renderHook(() =>
        useBannerResources({
          userStatsData: stats,
          userPlannedBannerData: [makeUmaBanner(3, `${daysFromNow(20)}T07:35:59Z`, 0)],
          ...noIncome,
        })
      )

      // Nothing is spent anywhere, so the last checkpoint must land on exactly
      // the same balance however many checkpoints precede it.
      expect(chained.result.current.at(-1)!.carats).toBe(
        single.result.current[0].carats
      )
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
