import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type {
  BannerCategory,
  BannerTimeline,
  BannerTimelineForViewing,
  SupportCard,
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
let events: BannerTimelineForViewing[] = BASE_EVENTS

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

/** A window of the given category, carrying the named umas and support cards. */
function categorised(
  id: number,
  category: BannerCategory,
  umas: string[],
  supports: string[] = [],
): BannerTimelineForViewing {
  const base = windowAt(id, '2099-03-01T22:00:00Z', '2099-03-08T21:59:59Z')
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
 * Category drives the chrome, count drives the grid.
 *
 * One caveat these tests can't get around: the clipping this phase fixes was
 * purely a CSS effect (`grid-rows-1` plus `xl:overflow-hidden` pinned the panel
 * to the banner art's height). jsdom applies no stylesheets, so every tile was
 * always in the DOM — asserting on rendered names would have passed before the
 * fix too. The class-name assertions below are therefore the real guard against
 * that regression, and the layouts were checked visually against the dev server.
 */
describe('Timeline banner categories', () => {
  /** The grid a named card's tile sits in. */
  function gridFor(name: string): HTMLElement {
    const grid = screen.getByAltText(name).closest('div.grid')
    expect(grid, `no grid around ${name}`).not.toBeNull()
    return grid as HTMLElement
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

    expect(screen.getByText('Golden Week Revival')).toBeInTheDocument()
    // Exactly one chip — a badge on every card would be noise, not signal.
    expect(screen.getAllByText(/Golden Week Revival|Rerun|Race Prep Support/))
      .toHaveLength(1)
  })

  it('opens a revival into one row of tiles, with no cap and no clip', () => {
    events = [categorised(1, 'golden_week_revival', REVIVAL_UMAS)]
    render(<Timeline />)

    const grid = gridFor('Hishi Miracle')
    // Eleven umas, eleven columns at xl — the horizontal band.
    expect(grid.className).toContain('xl:grid-cols-11')
    // The three classes that used to hide nine of them.
    expect(grid.className).not.toContain('grid-rows-1')
    expect(grid.className).not.toContain('overflow-hidden')
    expect(grid.className).not.toContain('contain:size')
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

  it('grows a narrow panel downwards rather than hiding the extra tiles', () => {
    // An uncategorised banner with four umas — the miscategorised-row case.
    // It renders plainly, but completely.
    events = [categorised(1, 'standard', ['A Uma', 'B Uma', 'C Uma', 'D Uma'])]
    render(<Timeline />)

    const grid = gridFor('D Uma')
    expect(grid.className).toContain('grid-cols-2')
    expect(grid.className).not.toContain('grid-rows-1')
    expect(grid.className).not.toContain('overflow-hidden')
  })
})
