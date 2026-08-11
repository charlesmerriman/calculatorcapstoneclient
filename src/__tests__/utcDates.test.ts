import { describe, it, expect } from 'vitest'
import {
  addUtcDays,
  ceilToTen,
  startOfUtcDay,
  startOfUtcMonth,
  startOfUtcWeek,
  utcDaysBetween,
  utcMonthsBetween,
  utcYearsBetween,
} from '../utils/utcDates'

const utc = (iso: string) => new Date(iso)

describe('utcDaysBetween — the sheet\'s DATEDIF(from, to, "D")', () => {
  it('counts day boundaries, not elapsed 24-hour spans', () => {
    // The case that makes this different from date-fns' differenceInDays.
    // Banner windows run <start>T22:00:00Z -> <end>T21:59:59Z, which is one
    // second short of a whole day, so an elapsed-span measure truncates it away.
    expect(utcDaysBetween(utc('2026-09-10T22:00:00Z'), utc('2026-09-22T21:59:59Z'))).toBe(12)
  })

  it('is zero within a single UTC day regardless of time', () => {
    expect(utcDaysBetween(utc('2026-08-11T00:00:00Z'), utc('2026-08-11T23:59:59Z'))).toBe(0)
  })

  it('goes negative for a backwards span so callers can clamp deliberately', () => {
    expect(utcDaysBetween(utc('2026-08-11T00:00:00Z'), utc('2026-08-09T00:00:00Z'))).toBe(-2)
  })

  it('is unaffected by the local timezone', () => {
    // Both instants are the same UTC day even though they straddle local
    // midnight for most of the world.
    expect(utcDaysBetween(utc('2026-08-11T01:00:00Z'), utc('2026-08-11T23:00:00Z'))).toBe(0)
  })
})

describe('utcMonthsBetween — DATEDIF(from, to, "M")', () => {
  it('counts only COMPLETE months', () => {
    // Jan 31 -> Feb 28 is 0: the day-of-month never came round again. This is
    // the case a plain month-number subtraction gets wrong.
    expect(utcMonthsBetween(utc('2026-01-31T00:00:00Z'), utc('2026-02-28T00:00:00Z'))).toBe(0)
  })

  it('completes the month once the day-of-month is reached', () => {
    expect(utcMonthsBetween(utc('2026-01-15T00:00:00Z'), utc('2026-02-15T00:00:00Z'))).toBe(1)
    expect(utcMonthsBetween(utc('2026-01-15T00:00:00Z'), utc('2026-02-14T00:00:00Z'))).toBe(0)
  })

  it('spans years', () => {
    expect(utcMonthsBetween(utc('2025-08-11T00:00:00Z'), utc('2026-08-11T00:00:00Z'))).toBe(12)
    expect(utcMonthsBetween(utc('2025-08-11T00:00:00Z'), utc('2026-08-10T00:00:00Z'))).toBe(11)
  })
})

describe('utcYearsBetween — DATEDIF(from, to, "Y")', () => {
  it('counts only complete years', () => {
    expect(utcYearsBetween(utc('2026-02-14T00:00:00Z'), utc('2027-02-13T00:00:00Z'))).toBe(0)
    expect(utcYearsBetween(utc('2026-02-14T00:00:00Z'), utc('2027-02-14T00:00:00Z'))).toBe(1)
  })
})

describe('calendar anchors', () => {
  it('startOfUtcMonth is the sheet\'s EOMONTH(d, -1) + 1', () => {
    expect(startOfUtcMonth(utc('2026-08-27T13:00:00Z')).toISOString()).toBe(
      '2026-08-01T00:00:00.000Z'
    )
  })

  it('startOfUtcWeek returns the Monday of the containing week', () => {
    // 2026-08-11 is a Tuesday.
    expect(startOfUtcWeek(utc('2026-08-11T13:00:00Z')).toISOString()).toBe(
      '2026-08-10T00:00:00.000Z'
    )
  })

  it('startOfUtcWeek treats Sunday as the END of its week, not the start', () => {
    // The sheet's WEEKDAY(d, 2) is 7 on Sunday, so Sunday belongs to the Monday
    // six days behind it. JS getUTCDay() calls Sunday 0, which would otherwise
    // push it forward a week.
    expect(startOfUtcWeek(utc('2026-08-16T12:00:00Z')).toISOString()).toBe(
      '2026-08-10T00:00:00.000Z'
    )
  })

  it('startOfUtcDay and addUtcDays compose', () => {
    expect(addUtcDays(startOfUtcDay(utc('2026-08-11T22:30:00Z')), 3).toISOString()).toBe(
      '2026-08-14T00:00:00.000Z'
    )
  })
})

describe('ceilToTen — CEILING(value, 10)', () => {
  it('rounds up to the next ten', () => {
    expect(ceilToTen(1111)).toBe(1120)
    expect(ceilToTen(1120)).toBe(1120)
  })

  it('clears float noise before the ceiling', () => {
    // (1 - 9/15) * 0.8 === 0.32000000000000006, which without the toFixed pass
    // pushes an exact 1120 out as 1130. The sheet's own cell reads 1120.
    expect(ceilToTen(((1 - 9 / 15) * 0.8) * 3500)).toBe(1120)
  })
})
