import { describe, it, expect } from 'vitest'
import { calculateMaxPossiblePulls } from '../utils/bannerHelpers'
import type { BannerTimeline, BannerUma, UserPlannedBanner } from '../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns a date string (YYYY-MM-DD) N days from today. */
function daysFromNow(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

/**
 * Returns a LOCAL datetime string (no trailing Z) for `dayOffset` days from
 * today at the given `HH:MM:SS`. Used for the "Passed" boundary tests: unlike a
 * date-only string (which JS parses as UTC midnight and drifts against the
 * local start-of-day), a local datetime is interpreted in the same timezone as
 * the code's `startOfDay(new Date())`, so the boundary assertions hold in every
 * timezone the suite might run in.
 */
function localDateTime(dayOffset: number, hms: string): string {
  const d = new Date()
  d.setDate(d.getDate() + dayOffset)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}T${hms}`
}

function makeTimeline(endDate: string): BannerTimeline {
  return {
    id: 1,
    name: 'Timeline',
    start_date: daysFromNow(-5),
    end_date: endDate,
    is_predicted: false,
    jp_start_date: null,
    jp_end_date: null,
    global_start_date: daysFromNow(-5),
    global_end_date: endDate,
    image: '',
  }
}

function makeUmaBanner(endDate: string, freePulls: number): UserPlannedBanner {
  const banner_uma: BannerUma = {
    id: 1,
    name: 'Uma Banner',
    admin_comments: '',
    umas: [],
    free_pulls: freePulls,
    banner_timeline: makeTimeline(endDate),
  }
  return {
    id: 1,
    user: 1,
    number_of_pulls: 0,
    banner_uma,
    banner_support: null,
  }
}

const noTickets = { umaTicketsAvailable: 0, supportTicketsAvailable: 0 }

// ── Tests ───────────────────────────────────────────────────────────────────

describe('calculateMaxPossiblePulls', () => {
  describe('total pull math', () => {
    it('sums free pulls, tickets, and floor(carats / 150)', () => {
      const result = calculateMaxPossiblePulls({
        plannedBanner: makeUmaBanner(daysFromNow(30), 3),
        caratsAvailable: 1_000, // floor(1000 / 150) = 6
        umaTicketsAvailable: 2,
        supportTicketsAvailable: 0,
      })
      expect(result).toBe(3 + 2 + 6)
    })

    it('floors fractional carat-pulls (does not round up)', () => {
      const result = calculateMaxPossiblePulls({
        plannedBanner: makeUmaBanner(daysFromNow(30), 0),
        caratsAvailable: 149, // floor(149 / 150) = 0
        ...noTickets,
      })
      expect(result).toBe(0)
    })
  })

  describe('bug 3 — never returns a negative max (clamped at 0)', () => {
    it('clamps to 0 when carats are negative (earlier banners overspent)', () => {
      const result = calculateMaxPossiblePulls({
        plannedBanner: makeUmaBanner(daysFromNow(30), 0),
        caratsAvailable: -5_000, // floor(-5000 / 150) = -34
        ...noTickets,
      })
      expect(result).toBe(0)
    })

    it('a small ticket/free count cannot rescue a large negative carat balance below 0', () => {
      const result = calculateMaxPossiblePulls({
        plannedBanner: makeUmaBanner(daysFromNow(30), 1),
        caratsAvailable: -5_000,
        umaTicketsAvailable: 1,
        supportTicketsAvailable: 0,
      })
      // 1 + 1 + (-34) = -32 → clamped to 0
      expect(result).toBe(0)
    })
  })

  describe('bug 4 — "Passed" is anchored to the start of today', () => {
    it('returns "Passed" for a banner that ended yesterday', () => {
      const result = calculateMaxPossiblePulls({
        plannedBanner: makeUmaBanner(localDateTime(-1, '23:59:00'), 3),
        caratsAvailable: 1_000,
        ...noTickets,
      })
      expect(result).toBe('Passed')
    })

    it('does NOT mark a banner ending earlier today as Passed', () => {
      // End time is just after local midnight today — earlier than "now" but
      // still on or after the start of today. Under the old `new Date()` cutoff
      // this would read as Passed by mid-afternoon; anchored to start-of-today
      // it stays active and returns a numeric estimate.
      const result = calculateMaxPossiblePulls({
        plannedBanner: makeUmaBanner(localDateTime(0, '00:00:01'), 3),
        caratsAvailable: 0,
        ...noTickets,
      })
      expect(result).not.toBe('Passed')
      expect(result).toBe(3)
    })
  })
})
