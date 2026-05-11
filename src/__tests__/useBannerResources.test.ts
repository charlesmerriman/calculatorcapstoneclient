import { renderHook } from '@testing-library/react'
import { useBannerResources } from '../hooks/useBannerResources'
import {
  DAILY_CARAT_PACK_PER_DAY,
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
  return { id, name: `LoH ${id}`, start_date: daysFromNow(0), end_date: endDate, image: null }
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

    it('does not count an event reward twice when two banners share the same window', () => {
      // Reward falls in banner 1's window (day 0–10). When banner 2 is processed
      // (day 10–20), lastEndDate = day 10, so the day-5 reward is excluded.
      const reward = makeEventReward(1, daysFromNow(5), 1_000)
      const { result: withReward } = renderHook(() =>
        useBannerResources({
          userStatsData: zeroStats,
          userPlannedBannerData: [
            makeUmaBanner(1, daysFromNow(10), 0),
            makeUmaBanner(2, daysFromNow(20), 0),
          ],
          ...noIncome,
          eventRewardsData: [reward],
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
          eventRewardsData: [],
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
    const cmRankWithIncome: ChampionsMeetingRank = { id: 2, name: 'Bronze', income_amount: cmIncome }

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
    const lohRankWithIncome: LeagueOfHeroesRank = { id: 2, name: 'Bronze', income_amount: lohIncome }

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
      const reward: EventReward = {
        ...makeEventReward(1, daysFromNow(10), 0),
        support_ticket_amount: 3,
      }
      const { result } = renderHook(() =>
        useBannerResources({
          userStatsData: zeroStats,
          userPlannedBannerData: [makeUmaBanner(1, daysFromNow(30), 0)],
          ...noIncome,
          eventRewardsData: [reward],
        })
      )
      expect(result.current[0].supportTickets).toBe(3)
    })
  })
})
