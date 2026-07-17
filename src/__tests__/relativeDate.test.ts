// @vitest-environment node
// Pure date helpers — no DOM needed.
import { formatRelativeDate, formatFullDate } from '../utils/relativeDate'

/** A "YYYY-MM-DD" string offset by `n` days from today (local time). */
function dateOffset(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

describe('formatRelativeDate', () => {
  it('returns "today" for the current day', () => {
    expect(formatRelativeDate(dateOffset(0))).toBe('today')
  })

  it('buckets recent past days', () => {
    // numeric:"auto" renders -1 day as "yesterday".
    expect(formatRelativeDate(dateOffset(-1))).toBe('yesterday')
    expect(formatRelativeDate(dateOffset(-3))).toMatch(/3 days ago/)
  })

  it('buckets by weeks under a month', () => {
    expect(formatRelativeDate(dateOffset(-14))).toMatch(/2 weeks ago/)
  })

  it('buckets by months under a year', () => {
    expect(formatRelativeDate(dateOffset(-60))).toMatch(/2 months ago/)
  })

  it('buckets by years past a year', () => {
    expect(formatRelativeDate(dateOffset(-800))).toMatch(/2 years ago/)
  })

  it('returns empty string for unparseable input', () => {
    expect(formatRelativeDate('not-a-date')).toBe('')
  })
})

describe('formatFullDate', () => {
  it('formats a valid ISO date into a readable string', () => {
    // Locale-dependent, but always contains the year and no time component.
    const out = formatFullDate('2026-07-16')
    expect(out).toMatch(/2026/)
    expect(out).toMatch(/16/)
  })

  it('falls back to the raw string when unparseable', () => {
    expect(formatFullDate('garbage')).toBe('garbage')
  })
})
