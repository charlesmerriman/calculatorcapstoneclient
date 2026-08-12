import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type {
  BannerCategory,
  BannerTimeline,
  BannerTimelineForViewing,
  ChampionsMeeting,
  SupportCard,
  TimelineEvent,
  Uma,
} from '../types'

/**
 * Timeline's infinite scroll is driven by an IntersectionObserver, which jsdom
 * doesn't implement. The component reads `typeof IntersectionObserver` once at
 * module scope to decide whether it can window the list at all, so the fake has
 * to exist *before* the module is imported — hence `vi.hoisted`, which runs
 * ahead of the hoisted ESM imports above.
 *
 * Crucially the fake fires each instance **at most once**, mirroring the real
 * API: an observer reports a *transition* into view, and stays silent while the
 * target remains there. So the only way this list keeps growing is if the
 * component tears its observer down and builds a new one after each append —
 * which is exactly the behaviour the effect's dependency list exists to produce,
 * and which a more permissive fake would let regress unnoticed.
 */
const { getActiveObserver, resetObservers } = vi.hoisted(() => {
  type FakeEntry = { isIntersecting: boolean }
  type FakeCallback = (entries: FakeEntry[]) => void
  type Instance = { callback: FakeCallback; disconnected: boolean; fired: boolean }

  const instances: Instance[] = []

  class FakeIntersectionObserver {
    root = null
    rootMargin = ''
    thresholds: number[] = []
    private instance: Instance

    constructor(callback: FakeCallback) {
      this.instance = { callback, disconnected: false, fired: false }
      instances.push(this.instance)
    }
    observe() {}
    unobserve() {}
    takeRecords() {
      return []
    }
    disconnect() {
      this.instance.disconnected = true
    }
  }

  globalThis.IntersectionObserver =
    FakeIntersectionObserver as unknown as typeof IntersectionObserver

  return {
    /** The newest observer that is still attached and hasn't already reported. */
    getActiveObserver: () =>
      [...instances].reverse().find((i) => !i.disconnected && !i.fired) ?? null,
    resetObservers: () => {
      instances.length = 0
    },
  }
})

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TOTAL_EVENTS = 25

/**
 * Banner windows with no featured umas or support cards. Each card still renders
 * its date header and both "No … in this window." panels, and that fallback
 * string is exactly one per card — which is what the card counting below uses.
 * Dates are in 2099 so every event survives the default current/future filter.
 */
const BASE_EVENTS: BannerTimelineForViewing[] = Array.from(
  { length: TOTAL_EVENTS },
  (_, i) => {
    const day = String(i + 1).padStart(2, '0')
    return {
      id: i + 1,
      name: `Window ${day}`,
      banner_category: 'standard',
      event_type: 'banner_timeline',
      start_date: `2099-01-${day}T22:00:00Z`,
      end_date: `2099-02-${day}T21:59:59Z`,
      is_predicted: false,
      jp_start_date: null,
      jp_end_date: null,
      global_start_date: `2099-01-${day}T22:00:00Z`,
      global_end_date: `2099-02-${day}T21:59:59Z`,
      // Confirmed rows carry no schedule correction, and these are diagnostic
      // only — the dates above are already complete.
      schedule_offset_days: 0,
      applied_offset_days: 0,
      image: null,
      banner_umas: [],
      banner_supports: [], anniversary_event: null,
    }
  },
)

/**
 * What the mocked context serves. Reassignable so a test can swap in a smaller,
 * purpose-built dataset — the mock factory below reads this at render time, not
 * at module load, so a reassignment before `render` takes effect. Restored in
 * an afterEach so it can't leak between suites.
 */
let events: TimelineEvent[] = BASE_EVENTS

/** A Champions Meeting, for asserting what the category filter does to races. */
function raceEvent(id: number, day: string): ChampionsMeeting {
  return {
    id,
    name: `Champions Meeting ${id}`,
    event_type: 'champions_meeting',
    cm_number: id,
    start_date: `2099-03-${day}T22:00:00Z`,
    end_date: `2099-04-${day}T21:59:59Z`,
    is_predicted: false,
    jp_start_date: null,
    jp_end_date: null,
    global_start_date: null,
    global_end_date: null,
    schedule_offset_days: 0,
    applied_offset_days: 0,
    image: null,
    track: 'Tokyo',
    surface_type: 'Turf',
    distance: 'Mile',
    length: '1600m',
    track_condition: 'Firm',
    season: 'Spring',
    weather: 'Sunny',
    direction: 'Left',
    speed_recommendation: '',
    stamina_recommendation: '',
  } as ChampionsMeeting
}

/** A banner window built off the base fixture, with only the dates that matter. */
function windowAt(
  id: number,
  start: string,
  end: string,
): BannerTimelineForViewing {
  return {
    ...BASE_EVENTS[0],
    id,
    name: `Window ${id}`,
    start_date: start,
    end_date: end,
    global_start_date: start,
    global_end_date: end,
  }
}

/**
 * The API omits `banner_timeline` from banners nested inside a timeline, but
 * the shared BannerUma/BannerSupport type still declares it. This stands in for
 * it so the fixtures below type-check without a cast.
 */
const NESTED_TIMELINE: BannerTimeline = {
  id: 0,
  name: 'nested',
  banner_category: 'standard',
  start_date: '2099-03-01T22:00:00Z',
  end_date: '2099-03-08T21:59:59Z',
  is_predicted: false,
  jp_start_date: null,
  jp_end_date: null,
  global_start_date: null,
  global_end_date: null,
  schedule_offset_days: 0,
  applied_offset_days: 0,
  image: '',
}

function card<T extends Uma | SupportCard>(id: number, name: string): T {
  return {
    id,
    name,
    image: `${name}.png`,
    admin_comments: '',
    recommendation: '',
    first_jp_date: null,
  } as T
}

/**
 * A window of the given category, carrying the named umas and support cards.
 *
 * Dates derive from the id so two calls produce two separate cards. Grouping
 * keys on an identical start date, and a helper that silently folded every
 * fixture into one card would make the filter tests below meaningless.
 */
function categorised(
  id: number,
  category: BannerCategory,
  umas: string[],
  supports: string[] = [],
): BannerTimelineForViewing {
  const day = String(id).padStart(2, '0')
  const base = windowAt(id, `2099-03-${day}T22:00:00Z`, `2099-04-${day}T21:59:59Z`)
  return {
    ...base,
    banner_category: category,
    banner_umas: umas.length
      ? [
          {
            id,
            banner_timeline: NESTED_TIMELINE,
            name: `Uma banner ${id}`,
            admin_comments: '',
            umas: umas.map((n, i) => card<Uma>(i + 1, n)),
            free_pulls: 0,
          },
        ]
      : [],
    banner_supports: supports.length
      ? [
          {
            id,
            banner_timeline: NESTED_TIMELINE,
            name: `Support banner ${id}`,
            admin_comments: '',
            support_cards: supports.map((n, i) => card<SupportCard>(i + 1, n)),
            free_pulls: 0,
          },
        ]
      : [],
  }
}

vi.mock('../services/CalculatorContext', () => ({
  useCalculatorData: () => ({
    organizedTimelineData: events,
    userPlannedBannerData: [],
    umaBannerData: [],
    supportBannerData: [],
    stagedBanners: [],
    setStagedBanners: vi.fn(),
  }),
}))

// Imported after the mocks above are registered.
const { Timeline } = await import('../components/timeline/Timeline')

/** One per rendered event card. */
function cardCount(): number {
  return screen.getAllByText('No Umamusume banner in this window.').length
}

/**
 * Drive the newest live observer as though the sentinel scrolled into view.
 * Fails if there isn't one — a stalled list is a failure, not a no-op.
 */
function scrollToSentinel(): void {
  const observer = getActiveObserver()
  expect(observer, 'no live observer — the list stalled').not.toBeNull()
  observer!.fired = true
  act(() => {
    observer!.callback([{ isIntersecting: true }])
  })
}

beforeEach(() => {
  localStorage.clear()
  // The paged view persists its page here; without this a test that pages
  // forward leaks its position into every test that renders afterwards.
  sessionStorage.clear()
  resetObservers()
})

afterEach(() => {
  events = BASE_EVENTS
})

describe('Timeline infinite scroll', () => {
  it('starts with one chunk and appends another each time the sentinel appears', () => {
    render(<Timeline />)

    expect(cardCount()).toBe(10)
    expect(screen.getByText('Loading more events...')).toBeInTheDocument()

    scrollToSentinel()
    expect(cardCount()).toBe(20)

    scrollToSentinel()
    expect(cardCount()).toBe(TOTAL_EVENTS)
  })

  it('stops at the full list and says so instead of spinning forever', () => {
    render(<Timeline />)

    scrollToSentinel()
    scrollToSentinel()

    expect(cardCount()).toBe(TOTAL_EVENTS)
    expect(screen.queryByText('Loading more events...')).not.toBeInTheDocument()
    expect(screen.getByText(`That's all ${TOTAL_EVENTS} events.`)).toBeInTheDocument()
    // Nothing left to watch for, so no observer should still be attached.
    expect(getActiveObserver()).toBeNull()
  })

  it('reaches every event, which paging alone could not do in one view', () => {
    render(<Timeline />)
    for (let i = 0; i < TOTAL_EVENTS; i++) {
      if (cardCount() >= TOTAL_EVENTS) break
      scrollToSentinel()
    }
    // Both ends of the list on screen at once.
    expect(screen.getByText(/2099\/1\/1 through/)).toBeInTheDocument()
    expect(screen.getByText(/2099\/1\/25 through/)).toBeInTheDocument()
  })

  it('restarts the reveal window when the search filter changes', () => {
    render(<Timeline />)
    scrollToSentinel()
    expect(cardCount()).toBe(20)

    fireEvent.change(screen.getByPlaceholderText('Search characters or events...'), {
      target: { value: 'Window 07' },
    })

    // Narrowed to a single match — the stale count must not survive.
    expect(cardCount()).toBe(1)
    expect(screen.getByText(/2099\/1\/7 through/)).toBeInTheDocument()
  })
})

describe('Timeline view mode', () => {
  it('defaults to infinite scroll and offers a switch to pages', () => {
    render(<Timeline />)

    // The count interleaves an element, so assert on full text content rather
    // than a text-node match.
    expect(screen.getByText(/Showing/)).toHaveTextContent(`Showing 10 of ${TOTAL_EVENTS}`)
    expect(screen.getByRole('button', { name: /use pages/i })).toBeInTheDocument()
    // Paged controls are absent in this mode.
    expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument()
  })

  it('switches to the original paged view and persists the choice', () => {
    render(<Timeline />)

    fireEvent.click(screen.getByRole('button', { name: /use pages/i }))

    expect(cardCount()).toBe(10)
    // Paged mode shows the Previous/Next controls, top and bottom.
    expect(screen.getAllByRole('button', { name: /next/i }).length).toBeGreaterThan(0)
    expect(screen.queryByText('Loading more events...')).not.toBeInTheDocument()
    expect(localStorage.getItem('uma-planner-timeline-view')).toBe('paged')
  })

  it('honours a stored paged preference on mount', () => {
    localStorage.setItem('uma-planner-timeline-view', 'paged')
    render(<Timeline />)

    expect(screen.getByRole('button', { name: /use infinite scroll/i })).toBeInTheDocument()
    expect(cardCount()).toBe(10)
  })

  it('pages through the list, reaching the last event on the final page', () => {
    localStorage.setItem('uma-planner-timeline-view', 'paged')
    render(<Timeline />)

    // 25 events / 10 per page = 3 pages.
    const next = screen.getAllByRole('button', { name: /next/i })[0]
    fireEvent.click(next)
    fireEvent.click(next)

    expect(cardCount()).toBe(5)
    expect(screen.getByText(/2099\/1\/25 through/)).toBeInTheDocument()
  })
})

// Navigating to the calculator unmounts this route entirely, so "keeping your
// place" is really "surviving an unmount" — which is what unmount/re-render
// stands in for here.
describe('Timeline paged position', () => {
  beforeEach(() => {
    localStorage.setItem('uma-planner-timeline-view', 'paged')
  })

  /** The indicator renders twice (above and below the list); both read the same. */
  function pageIndicator(): HTMLElement {
    return screen.getAllByText(/Page/)[0]
  }

  it('returns to the page the user left, not page 1', () => {
    const view = render(<Timeline />)

    fireEvent.click(screen.getAllByRole('button', { name: /next/i })[0])
    expect(pageIndicator()).toHaveTextContent('Page 2 of 3')

    view.unmount()
    render(<Timeline />)

    expect(pageIndicator()).toHaveTextContent('Page 2 of 3')
    // Page 2 of 25 events is windows 11-20.
    expect(screen.getByText(/2099\/1\/11 through/)).toBeInTheDocument()
    expect(screen.queryByText(/2099\/1\/1 through/)).not.toBeInTheDocument()
  })

  it('clamps a stored page that now exceeds the list instead of rendering empty', () => {
    // As if the user left from a longer list — 25 events only reach page 3.
    sessionStorage.setItem('uma-planner-timeline-page', '9')
    render(<Timeline />)

    expect(pageIndicator()).toHaveTextContent('Page 3 of 3')
    expect(cardCount()).toBe(5)
  })

  it('ignores a corrupt stored page', () => {
    sessionStorage.setItem('uma-planner-timeline-page', 'not-a-page')
    render(<Timeline />)

    expect(pageIndicator()).toHaveTextContent('Page 1 of 3')
  })

  it('drops the stored position when the filter changes, so it cannot be restored stale', () => {
    render(<Timeline />)
    fireEvent.click(screen.getAllByRole('button', { name: /next/i })[0])

    fireEvent.change(screen.getByPlaceholderText('Search characters or events...'), {
      target: { value: 'Window 0' },
    })

    expect(sessionStorage.getItem('uma-planner-timeline-page')).toBe('1')
  })
})

describe('Timeline date formatting', () => {
  it('renders banner windows as YYYY/M/D', () => {
    render(<Timeline />)
    // 2099-01-01T22:00:00Z through 2099-02-01T21:59:59Z, as local calendar days.
    const start = new Date('2099-01-01T22:00:00Z')
    const end = new Date('2099-02-01T21:59:59Z')
    const expected = `${start.getFullYear()}/${start.getMonth() + 1}/${start.getDate()} through ${end.getFullYear()}/${end.getMonth() + 1}/${end.getDate()}`

    expect(screen.getByText(expected)).toBeInTheDocument()
  })
})

/**
 * The grouping rule itself is covered in timelineShared.test.ts. What matters
 * here is that the list actually renders a group as ONE card — the counts, the
 * paging and the "showing X of Y" indicator all measure rows, not raw events.
 */
describe('Timeline concurrent banners', () => {
  /** One per rendered card — the date header appears exactly once per card. */
  function headerCount(): number {
    return screen.getAllByText(/ through /).length
  }

  it('renders two banners opening at the same moment as a single card', () => {
    events = [
      windowAt(1, '2099-03-01T22:00:00Z', '2099-03-08T21:59:59Z'),
      windowAt(2, '2099-03-01T22:00:00Z', '2099-03-08T21:59:59Z'),
    ]
    render(<Timeline />)

    expect(headerCount()).toBe(1)
    // Both banners still render their own panels and their own add buttons
    // inside that one card — they are separate gacha pools.
    expect(cardCount()).toBe(2)
    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 1 of 1')
  })

  it('shows the union window, and flags the banner that runs longer', () => {
    // The real 2025 Golden Week shape: the revival outlasts the standard banner
    // it opened alongside.
    events = [
      windowAt(1, '2099-03-01T22:00:00Z', '2099-03-08T21:59:59Z'),
      windowAt(2, '2099-03-01T22:00:00Z', '2099-03-17T21:59:59Z'),
    ]
    render(<Timeline />)

    const start = new Date('2099-03-01T22:00:00Z')
    const unionEnd = new Date('2099-03-17T21:59:59Z')
    const shortEnd = new Date('2099-03-08T21:59:59Z')
    const fmt = (d: Date) => `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`

    // Header covers the whole window...
    expect(
      screen.getByText(`${fmt(start)} through ${fmt(unionEnd)}`),
    ).toBeInTheDocument()
    // ...and the shorter banner says when it actually stops, so the header
    // can't imply you have until the 17th to pull on it.
    expect(
      screen.getByText(`This banner ends ${fmt(shortEnd)}`),
    ).toBeInTheDocument()
  })

  it('says nothing extra when both banners share an end date', () => {
    events = [
      windowAt(1, '2099-03-01T22:00:00Z', '2099-03-08T21:59:59Z'),
      windowAt(2, '2099-03-01T22:00:00Z', '2099-03-08T21:59:59Z'),
    ]
    render(<Timeline />)

    expect(screen.queryByText(/This banner ends/)).not.toBeInTheDocument()
  })

  it('never groups across the past/future boundary', () => {
    // Same start date, but one has already ended. Grouping runs after the
    // filter, so the ended banner must not be dragged into the current view.
    const past = windowAt(1, '2099-03-01T22:00:00Z', '2000-01-01T00:00:00Z')
    const future = windowAt(2, '2099-03-01T22:00:00Z', '2099-03-08T21:59:59Z')
    events = [past, future]
    render(<Timeline />)

    expect(headerCount()).toBe(1)
    expect(cardCount()).toBe(1)
  })
})

/**
 * Category drives the chrome, count drives the layout.
 *
 * One caveat these tests can't get around: the defects here are CSS effects, and
 * jsdom applies no stylesheets. Every tile is in the DOM either way, so
 * asserting on rendered names would have passed before each fix too. What the
 * band assertions below can check structurally is the ONE-LINE guarantee — a
 * band's tiles are all direct children of a single flex row, so counting them
 * proves there is no second row to wrap onto. That is a stronger guard than the
 * class-name sniffing it replaces, which asserted `xl:grid-cols-N` and so was
 * blind to the band collapsing to two columns below 1280px. The widths
 * themselves were checked visually at 420 / 1150 / 1280 / 1600.
 */
describe('Timeline banner categories', () => {
  /** The grid a named card's tile sits in — compact column layout only. */
  function gridFor(name: string): HTMLElement {
    const grid = screen.getByAltText(name).closest('div.grid')
    expect(grid, `no grid around ${name}`).not.toBeNull()
    return grid as HTMLElement
  }

  /**
   * The one-line band a named card sits in, as its scroller and its row.
   *
   * `row.children` is the assertion that matters: a band puts every tile on one
   * flex row, so the child count IS the line length. If the layout ever wraps
   * again, tiles land on a second row and the count stops matching.
   */
  function bandFor(name: string): { scroller: HTMLElement; row: HTMLElement } {
    const scroller = screen.getByAltText(name).closest('div.overflow-x-auto')
    expect(scroller, `no band scroller around ${name}`).not.toBeNull()
    const row = (scroller as HTMLElement).firstElementChild as HTMLElement
    expect(row.className).toContain('flex')
    // A band must never be a grid again — that is what let it wrap at two.
    expect(row.className).not.toContain('grid')
    return { scroller: scroller as HTMLElement, row }
  }

  const REVIVAL_UMAS = [
    'Oguri Cap (Christmas)',
    'Gold Ship (Summer)',
    "Gold Ship (Project L'Arc)",
    'Mejiro McQueen (Summer)',
    'Tamamo Cross (Festival)',
    'Curren Chan (Wedding)',
    'Seiun Sky (Ballroom)',
    'Hishi Miracle',
    'Biwa Hayahide (Christmas)',
    'Biwa Hayahide (Mecha)',
    'Nakayama Festa',
  ]

  it('marks a Golden Week revival and leaves a standard banner unmarked', () => {
    events = [
      categorised(1, 'golden_week_revival', ['Oguri Cap (Christmas)']),
      categorised(2, 'standard', ['Yukino Bijin'], ['Smart Falcon']),
    ]
    render(<Timeline />)

    // Queried by class rather than text: the category filter's dropdown carries
    // the same words in an <option>, and this assertion is about the chip.
    // Exactly one — a badge on every card would be noise, not signal.
    const chips = document.querySelectorAll('.category-chip')
    expect(chips).toHaveLength(1)
    expect(chips[0]).toHaveTextContent('Golden Week Revival')
  })

  it('opens a revival into one row of tiles, with no cap and no clip', () => {
    events = [categorised(1, 'golden_week_revival', REVIVAL_UMAS)]
    render(<Timeline />)

    const { scroller, row } = bandFor('Hishi Miracle')
    // Eleven umas, eleven tiles, one row — at every width, not just xl.
    expect(row.children).toHaveLength(REVIVAL_UMAS.length)
    // A line too long to fit scrolls inside its own container, which is what
    // keeps it off the page's horizontal scrollbar.
    expect(scroller.className).toContain('overflow-x-auto')
    // The three classes that used to hide nine of them.
    expect(row.className).not.toContain('grid-rows-1')
    expect(scroller.className).not.toContain('overflow-hidden')
    expect(scroller.className).not.toContain('contain:size')
  })

  it('drops the empty art and support columns a revival would leave behind', () => {
    // Every revival we hold has no art and no support cards, so the ordinary
    // three-column section would spend two thirds of a full-width row on
    // placeholders.
    events = [categorised(1, 'golden_week_revival', REVIVAL_UMAS)]
    render(<Timeline />)

    expect(screen.queryByText('Banner art coming soon')).not.toBeInTheDocument()
    expect(
      screen.queryByText('No support banner in this window.'),
    ).not.toBeInTheDocument()
  })

  it('still shows a revival its support cards if the data ever grows them', () => {
    // Category picks the shape; the data decides what goes in it.
    events = [
      categorised(1, 'golden_week_revival', ['Oguri Cap (Christmas)'], ['Kitasan Black']),
    ]
    render(<Timeline />)

    expect(screen.getByAltText('Kitasan Black')).toBeInTheDocument()
  })

  it('labels a rerun without changing its layout', () => {
    events = [categorised(1, 'rerun', ['Gentildonna'], ['Kitasan Black'])]
    render(<Timeline />)

    expect(screen.getByText('Rerun')).toBeInTheDocument()
    // Still the ordinary three-column section, art placeholder included.
    expect(screen.getByText('Banner art coming soon')).toBeInTheDocument()
    expect(gridFor('Gentildonna').className).not.toContain('xl:grid-cols-')
  })

  it('degrades a race-prep batch that has no uma at all', () => {
    // Two of the sheet's 32 race-prep rows carry no uma — the first ever, and
    // an unfilled placeholder. The uma panel must stay and say so.
    events = [
      categorised(1, 'race_prep_support', [], ['Kitasan Black', 'Super Creek']),
    ]
    render(<Timeline />)

    expect(screen.getByText('Race Prep Support')).toBeInTheDocument()
    expect(screen.getByText('No Umamusume banner in this window.')).toBeInTheDocument()
    expect(screen.getByAltText('Super Creek')).toBeInTheDocument()
  })

  it('opens into bands on card count alone, with no category to go on', () => {
    // The JP launch banner: nine umas and twenty support cards on a `standard`
    // row with no art. No category could have flagged it, so the layout has to
    // key off the counts.
    const umas = Array.from({ length: 9 }, (_, i) => `Launch Uma ${i + 1}`)
    const supports = Array.from({ length: 20 }, (_, i) => `Launch Card ${i + 1}`)
    events = [categorised(1, 'standard', umas, supports)]
    render(<Timeline />)

    // Both sides get their own horizontal line, each holding all of its cards.
    expect(bandFor('Launch Uma 9').row.children).toHaveLength(9)
    expect(bandFor('Launch Card 20').row.children).toHaveLength(20)
    // ...and every card is present, none capped away.
    expect(screen.getByAltText('Launch Uma 1')).toBeInTheDocument()
    expect(screen.getByAltText('Launch Card 1')).toBeInTheDocument()
    // No art, so no full-width placeholder above the bands.
    expect(screen.queryByText('Banner art coming soon')).not.toBeInTheDocument()
  })

  it('expands when only the support side is oversized', () => {
    // A race-prep batch: one uma, ten support cards.
    const supports = Array.from({ length: 10 }, (_, i) => `Card ${i + 1}`)
    events = [categorised(1, 'race_prep_support', ['Satono Crown'], supports)]
    render(<Timeline />)

    expect(bandFor('Card 10').row.children).toHaveLength(10)
    // The lone uma gets a band too, so both halves read as lines rather than
    // one line above a single tile stranded in a two-column grid.
    expect(bandFor('Satono Crown').row.children).toHaveLength(1)
    expect(screen.getByText('Race Prep Support')).toBeInTheDocument()
  })

  it('keeps an ordinary two-card banner in the compact columns', () => {
    // The overwhelmingly common row must be untouched by all of the above.
    events = [categorised(1, 'standard', ['A', 'B'], ['C', 'D'])]
    render(<Timeline />)

    expect(gridFor('A').className).not.toContain('xl:grid-cols-')
    expect(gridFor('C').className).not.toContain('xl:grid-cols-')
    // Compact sections still show the art placeholder.
    expect(screen.getByText('Banner art coming soon')).toBeInTheDocument()
  })

  it('puts a miscategorised four-uma row on one line rather than a tower', () => {
    // An uncategorised banner with four umas — the miscategorised-row case. It
    // renders plainly, but completely, and on one line: the count alone is
    // enough to open the band, with no category to go on.
    //
    // This used to assert `grid-cols-2` and pass, because a band WAS a
    // two-column grid until xl. That is the bug, not the contract — four umas
    // in a 2×2 block with a gutter of dead space beside them is what the
    // one-line rule replaces.
    events = [categorised(1, 'standard', ['A Uma', 'B Uma', 'C Uma', 'D Uma'])]
    render(<Timeline />)

    const { row } = bandFor('D Uma')
    expect(row.children).toHaveLength(4)
    expect(row.className).not.toContain('grid-cols-2')
    expect(row.className).not.toContain('grid-rows-1')
  })
})

/**
 * The category filter. The load-bearing rule is that it runs on GROUPS, not on
 * events: a window survives if any of its banners matches, so filtering for
 * revivals keeps the ordinary banner sharing that card rather than presenting a
 * week that looks emptier than it was.
 */
describe('Timeline category filter', () => {
  const FILTER = /filter by banner type/i

  function selectCategory(value: string): void {
    fireEvent.change(screen.getByLabelText(FILTER), { target: { value } })
  }

  it('offers only the categories the data actually contains', () => {
    // race_prep_support is absent until the support backfill lands, so it must
    // not appear as an option that can only return "No events found."
    events = [
      categorised(1, 'standard', ['Yukino Bijin']),
      categorised(2, 'golden_week_revival', ['Oguri Cap (Christmas)']),
    ]
    render(<Timeline />)

    const options = Array.from(
      screen.getByLabelText(FILTER).querySelectorAll('option'),
    ).map((o) => o.textContent)

    expect(options).toEqual(['All events', 'Standard', 'Golden Week Revival'])
  })

  it('hides itself when there is nothing to choose between', () => {
    events = [categorised(1, 'standard', ['Yukino Bijin'])]
    render(<Timeline />)

    expect(screen.queryByLabelText(FILTER)).not.toBeInTheDocument()
  })

  it('sits with the search box, ahead of it', () => {
    // Both controls narrow the list, so they share the trailing end of the
    // control bar — the filter first. It used to sit among the view-mode
    // toggles at the other end, which put two unrelated jobs in one group.
    events = [
      categorised(1, 'standard', ['Yukino Bijin']),
      categorised(2, 'golden_week_revival', ['Oguri Cap (Christmas)']),
    ]
    render(<Timeline />)

    const filter = screen.getByLabelText(FILTER)
    const search = screen.getByPlaceholderText(/search characters or events/i)

    expect(filter.parentElement).toBe(search.parentElement?.parentElement)
    // DOCUMENT_POSITION_FOLLOWING: the search box comes after the filter.
    expect(filter.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy()
  })

  it('narrows the list to the chosen category', () => {
    events = [
      categorised(1, 'standard', ['Yukino Bijin']),
      categorised(2, 'golden_week_revival', ['Oguri Cap (Christmas)']),
      categorised(3, 'rerun', ['Gentildonna']),
    ]
    render(<Timeline />)
    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 3 of 3')

    selectCategory('golden_week_revival')

    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 1 of 1')
    expect(screen.getByAltText('Oguri Cap (Christmas)')).toBeInTheDocument()
    expect(screen.queryByAltText('Gentildonna')).not.toBeInTheDocument()
  })

  it('keeps a whole window when only one of its banners matches', () => {
    // The Golden Week shape: a revival and an ordinary banner opening together.
    // Filtering for revivals must not strip the neighbour off the shared card.
    const revival = categorised(1, 'golden_week_revival', ['Oguri Cap (Christmas)'])
    const alongside = {
      ...categorised(2, 'standard', ['Copano Rickey (Parade)']),
      start_date: revival.start_date,
      end_date: revival.end_date,
    }
    events = [revival, alongside]
    render(<Timeline />)

    selectCategory('golden_week_revival')

    expect(screen.getByAltText('Oguri Cap (Christmas)')).toBeInTheDocument()
    expect(screen.getByAltText('Copano Rickey (Parade)')).toBeInTheDocument()
  })

  it('drops race events once a banner category is chosen', () => {
    events = [
      categorised(1, 'standard', ['Yukino Bijin']),
      categorised(2, 'rerun', ['Gentildonna']),
      raceEvent(9, '05'),
    ]
    render(<Timeline />)
    expect(screen.getByText('Champions Meeting 9')).toBeInTheDocument()

    // A Champions Meeting has no banner category, so it cannot match one.
    selectCategory('rerun')

    expect(screen.queryByText('Champions Meeting 9')).not.toBeInTheDocument()
    expect(screen.getByAltText('Gentildonna')).toBeInTheDocument()
  })

  it('restores everything, race events included, on "All events"', () => {
    events = [
      categorised(1, 'standard', ['Yukino Bijin']),
      categorised(2, 'rerun', ['Gentildonna']),
      raceEvent(9, '05'),
    ]
    render(<Timeline />)

    selectCategory('rerun')
    selectCategory('all')

    expect(screen.getByText('Champions Meeting 9')).toBeInTheDocument()
    expect(screen.getByAltText('Yukino Bijin')).toBeInTheDocument()
  })

  it('resets the paged position, which could otherwise outrun the result', () => {
    localStorage.setItem('uma-planner-timeline-view', 'paged')
    sessionStorage.setItem('uma-planner-timeline-page', '2')
    events = [
      ...Array.from({ length: 12 }, (_, i) => categorised(i + 1, 'standard', [`Uma ${i + 1}`])),
      categorised(13, 'rerun', ['Gentildonna']),
    ]
    render(<Timeline />)
    expect(screen.getAllByText(/Page/)[0]).toHaveTextContent('Page 2 of 2')

    selectCategory('rerun')

    expect(sessionStorage.getItem('uma-planner-timeline-page')).toBe('1')
    expect(screen.getByAltText('Gentildonna')).toBeInTheDocument()
  })
})
