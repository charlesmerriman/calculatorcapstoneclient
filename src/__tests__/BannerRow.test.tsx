import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BannerRow } from '../components/carat-calculator/BannerRow'
import type { BannerUma, UserPlannedBanner, UserStats } from '../types'
import { EMPTY_BANNER_RESOURCES } from '../hooks/useBannerResources'

// react-select renders a portal-based combobox that contributes nothing to what
// these tests assert (the pull-count field); stub it so the DOM stays small and
// the queries below can't accidentally match its internals.
vi.mock('react-select', () => ({ default: () => null }))

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** A banner window comfortably in the future, so it never reads as "Passed". */
const timeline = {
  id: 1,
  name: 'Test Timeline',
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
  id: 10,
  banner_timeline: timeline,
  name: 'Test Uma Banner',
  admin_comments: '',
  umas: [],
  free_pulls: 0,
}

const userStats: UserStats = {
  current_carat: 0,
  current_paid_carat: 0,
  uma_ticket: 0,
  support_ticket: 0,
  daily_carat: false,
  training_pass: false,
  misc_earnings: true,
  monthly_shop_tickets: false,
  discounted_paid_pulls: false,
  full_price_paid_pulls: true,
  club_rank: null,
  team_trials_rank: null,
  champions_meeting_rank: null,
  league_of_heroes_rank: null,
  ssr_crystals: 0,
  sr_crystals: 0,
  ssr_shards: 0,
  sr_shards: 0,
}

function renderRow(numberOfPulls: number, maxPulls: number) {
  const planned: UserPlannedBanner = {
    tempId: 1,
    number_of_pulls: numberOfPulls,
    banner_uma: umaBanner,
    initialBannerType: 'Uma',
  }
  const setUserPlannedBannerData = vi.fn()

  render(
    <BannerRow
      plannedBanner={planned}
      userPlannedBannerData={[planned]}
      clubRankData={[]}
      teamTrialsRankData={[]}
      championsMeetingRankData={[]}
      userStatsData={userStats}
      umaBannerData={[umaBanner]}
      supportBannerData={[]}
      setUserPlannedBannerData={setUserPlannedBannerData}
      resources={{ ...EMPTY_BANNER_RESOURCES, maxPossiblePulls: maxPulls }}
      initialBannerType="Uma"
    />,
  )

  // The row renders the field twice (a mobile card and a desktop row, hidden
  // from each other by CSS breakpoints only). Both are in the DOM under jsdom,
  // so grab all of them and assert on the shared state.
  const inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[]
  return { inputs, setUserPlannedBannerData }
}

/** The state class currently on the field, e.g. "over". */
function statusOf(input: HTMLInputElement): string | undefined {
  return Array.from(input.classList)
    .find((c) => c.startsWith('pull-input--'))
    ?.replace('pull-input--', '')
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BannerRow — pull count entry', () => {
  it('accepts a value above the affordable max instead of clamping it', () => {
    const { inputs, setUserPlannedBannerData } = renderRow(0, 30)

    fireEvent.change(inputs[0], { target: { value: '450' } })

    // The whole point of the change: 450 survives even though only 30 are
    // affordable. Previously this was rewritten to 30.
    const updated = setUserPlannedBannerData.mock.calls[0][0] as UserPlannedBanner[]
    expect(updated[0].number_of_pulls).toBe(450)
  })

  it('still floors decimals and rejects negatives', () => {
    const { inputs, setUserPlannedBannerData } = renderRow(0, 1_000)

    fireEvent.change(inputs[0], { target: { value: '2.7' } })
    expect(
      (setUserPlannedBannerData.mock.calls[0][0] as UserPlannedBanner[])[0].number_of_pulls,
    ).toBe(2)

    fireEvent.change(inputs[0], { target: { value: '-5' } })
    expect(
      (setUserPlannedBannerData.mock.calls[1][0] as UserPlannedBanner[])[0].number_of_pulls,
    ).toBe(0)
  })

  it('no longer caps the spinner arrows with a max attribute', () => {
    const { inputs } = renderRow(0, 30)
    inputs.forEach((input) => expect(input).not.toHaveAttribute('max'))
  })
})

describe('BannerRow — pull count status colouring', () => {
  it('marks an unaffordable count as over, on every rendered field', () => {
    const { inputs } = renderRow(450, 30)
    inputs.forEach((input) => expect(statusOf(input)).toBe('over'))
  })

  it('marks an affordable count on a pity threshold as ok', () => {
    const { inputs } = renderRow(200, 1_000)
    inputs.forEach((input) => expect(statusOf(input)).toBe('ok'))
  })

  it('marks an affordable count off a pity threshold as neutral', () => {
    const { inputs } = renderRow(137, 1_000)
    inputs.forEach((input) => expect(statusOf(input)).toBe('neutral'))
  })

  it('exposes the over state to assistive tech, not just as colour', () => {
    const { inputs } = renderRow(450, 30)
    inputs.forEach((input) => {
      expect(input).toHaveAttribute('aria-invalid', 'true')
      expect(input).toHaveAttribute('title', expect.stringContaining('max 30'))
    })
  })

  it('does not mark an affordable count as invalid', () => {
    const { inputs } = renderRow(200, 1_000)
    inputs.forEach((input) => expect(input).toHaveAttribute('aria-invalid', 'false'))
  })
})
