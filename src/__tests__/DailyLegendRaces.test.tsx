import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SiteContentContext } from '../services/SiteContentContext'
import { buildSiteContentValue } from '../services/siteContent'
import { DEFAULT_CONSTANTS } from '../constants/gameConstants'
import type { Account, Oshi } from '../types/account'
import type { CalculationConstants, DailyLegendRaceRelease } from '../types'
import type { SiteContent } from '../types/siteContent'

/**
 * The Legend Races tab. Pins what it shows and hides, not its styling: the
 * oshi strip, the search, the collapsed "already out" list and the deep link
 * from a Timeline marker. The date maths has its own unit tests
 * (dailyLegendRaces.test.ts).
 *
 * Dates sit in 2020 (out) and 2099 (to come) so "now" never matters.
 */

const uma = (id: number, name: string, rarity: 1 | 2 | 3 = 3) => ({ id, name, image: null, rarity })

const OUT = {
  id: 1,
  name: '1st Anniversary',
  image: null,
  start_date: '2020-03-26T22:00:00Z',
  is_predicted: false,
  applied_offset_days: 0,
  umas: [uma(10, 'Special Week'), uma(11, 'King Halo', 1)],
} satisfies DailyLegendRaceRelease

const NEXT = {
  id: 2,
  name: '2nd Anniversary',
  image: null,
  start_date: '2099-12-22T22:00:00Z',
  is_predicted: true,
  applied_offset_days: 0,
  umas: [uma(20, 'Hishi Amazon'), uma(21, 'Mejiro Dober')],
} satisfies DailyLegendRaceRelease

const LATER = {
  id: 3,
  name: '2.5th Anniversary',
  image: null,
  start_date: '2100-04-14T22:00:00Z',
  is_predicted: true,
  applied_offset_days: 0,
  umas: [uma(30, 'Nishino Flower')],
} satisfies DailyLegendRaceRelease

let releases: DailyLegendRaceRelease[] = []
let account: Account | null = null
let constants: CalculationConstants = DEFAULT_CONSTANTS

vi.mock('../services/CalculatorContext', () => ({
  useCalculatorData: () => ({
    dailyLegendRaceData: releases,
    calculationConstants: constants,
  }),
}))

vi.mock('../services/AuthContext', () => ({
  useAccount: () => ({ account }),
}))

const { DailyLegendRaces } = await import('../components/legend-races/DailyLegendRaces')

const CONTENT: SiteContent = {
  pages: [
    {
      slug: 'daily-legend-races',
      title: 'Daily Legend Races',
      meta_description: 'x',
      body: 'Every uma has her own race.',
      updated_at: '2026-10-05T00:00:00Z',
    },
  ],
}

function renderPage(url = '/app/legend-races') {
  return render(
    <SiteContentContext.Provider value={buildSiteContentValue(CONTENT)}>
      <MemoryRouter initialEntries={[url]}>
        <DailyLegendRaces />
      </MemoryRouter>
    </SiteContentContext.Provider>
  )
}

const oshi = (position: number, id: number, name: string): Oshi => ({ position, id, name, image: '' })

function supporterWith(oshis: Oshi[], slots: number): Account {
  return {
    username: 'user_a',
    display_name: '',
    avatar_url: null,
    oshis,
    oshi_slots: slots,
    linked_providers: [],
    supporter: { is_supporter: slots > 0 },
  }
}

type ScrollIntoViewFn = (options?: boolean | ScrollIntoViewOptions) => void
let scrollIntoView: ReturnType<typeof vi.fn<ScrollIntoViewFn>>

beforeEach(() => {
  releases = [OUT, NEXT, LATER]
  account = null
  constants = DEFAULT_CONSTANTS
  scrollIntoView = vi.fn<ScrollIntoViewFn>()
  Element.prototype.scrollIntoView = scrollIntoView
})

afterEach(() => {
  delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView
})

describe('DailyLegendRaces', () => {
  it('renders the admin title and intro, and the batches to come soonest first', () => {
    renderPage()

    expect(screen.getByRole('heading', { level: 1, name: 'Daily Legend Races' })).toBeInTheDocument()
    expect(screen.getByText('Every uma has her own race.')).toBeInTheDocument()
    const names = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(names).toEqual(['2nd Anniversary', '2.5th Anniversary'])
  })

  it('starts with the batches already out collapsed', () => {
    renderPage()

    const toggle = screen.getByRole('button', { name: /Already in the daily races \(1\)/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('1st Anniversary')).not.toBeInTheDocument()

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('heading', { level: 3, name: '1st Anniversary' })).toBeInTheDocument()
  })

  it('builds the grind line from the admin numbers', () => {
    constants = { ...DEFAULT_CONSTANTS, daily_legend_race_piece_goal: 140 }
    renderPage()

    const card = screen.getByRole('region', { name: '2nd Anniversary' })
    expect(within(card).getByText(/To get one uma to 140 pieces from the day they arrive: 60 days/)).toBeInTheDocument()
  })

  it('search hides a batch with no matching uma and opens the list already out', () => {
    renderPage()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search umas' }), {
      target: { value: 'king' },
    })

    expect(screen.queryByText('2nd Anniversary')).not.toBeInTheDocument()
    expect(screen.queryByText('2.5th Anniversary')).not.toBeInTheDocument()
    const card = screen.getByRole('region', { name: '1st Anniversary' })
    expect(within(card).getByText('King Halo')).toBeInTheDocument()
    expect(within(card).queryByText('Special Week')).not.toBeInTheDocument()
  })

  it('shows no oshi strip for a guest', () => {
    renderPage()
    expect(screen.queryByRole('region', { name: 'Your oshis' })).not.toBeInTheDocument()
  })

  it('lists only the oshis the tier covers, and only those in a dated batch', () => {
    account = supporterWith(
      [
        oshi(0, 20, 'Hishi Amazon'),
        oshi(1, 99, 'Not In Any Batch'),
        oshi(2, 10, 'Special Week'),
        // Past the slot count: kept on the account, but not covered.
        oshi(3, 30, 'Nishino Flower'),
      ],
      3
    )
    renderPage()

    const strip = screen.getByRole('region', { name: 'Your oshis' })
    const lines = within(strip).getAllByRole('listitem').map((li) => li.textContent)
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatch(/^Hishi Amazon: joins .* \(2nd Anniversary\)$/)
    expect(lines[1]).toBe('Special Week: in the daily races now (1st Anniversary)')
  })

  it('opens the list and scrolls when a link names a batch already out', () => {
    renderPage('/app/legend-races?release=1')

    expect(screen.getByRole('button', { name: /Already in the daily races/ })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
    expect(screen.getByRole('heading', { level: 3, name: '1st Anniversary' })).toBeInTheDocument()
    expect(scrollIntoView).toHaveBeenCalled()
  })

  it('links each card to its Timeline marker', () => {
    renderPage()
    const card = screen.getByRole('region', { name: '2nd Anniversary' })
    expect(within(card).getByRole('link', { name: 'See it on the Timeline' })).toHaveAttribute(
      'href',
      '/app/timeline?focus=legend_race-2'
    )
  })

  it('shows the empty state when no batch has a date, as on an API without the feature', () => {
    releases = []
    renderPage()

    expect(screen.getByText(/No batches are scheduled yet/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Already in the daily races/ })).not.toBeInTheDocument()
  })
})
