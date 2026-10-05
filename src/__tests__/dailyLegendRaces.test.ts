import { describe, it, expect } from 'vitest'
import {
  arrivalCountdown,
  datedReleases,
  grindFinish,
  legendRacesByBanner,
  rarityGroups,
  releaseByUmaId,
  splitByToday,
} from '../utils/dailyLegendRaces'
import type { DailyLegendRaceRelease, DailyLegendRaceUma } from '../types'

/**
 * The Legend Races page's rules, tested without React.
 *
 * The grind cases are the worked example from legend-races-plan.md, with
 * today = 2026-10-05: a batch still to come counts from its own date, one
 * already out counts from today, and the finish is the day of the LAST race.
 */

const uma = (id: number, rarity: 1 | 2 | 3, name = `Uma ${id}`): DailyLegendRaceUma => ({
  id,
  name,
  image: null,
  rarity,
})

const release = (
  id: number,
  start_date: string | null,
  umas: DailyLegendRaceUma[] = []
): DailyLegendRaceRelease => ({
  id,
  name: `Release ${id}`,
  image: null,
  start_date,
  is_predicted: false,
  applied_offset_days: 0,
  umas,
})

const day = (iso: string) => new Date(`${iso}T00:00:00Z`)
const NOW = new Date('2026-10-05T12:00:00Z')
const DEFAULTS = { goal: 150, perDay: 1 }

describe('datedReleases', () => {
  it('drops the undated and sorts the rest soonest first', () => {
    const later = release(1, '2027-04-14T00:00:00Z')
    const undated = release(2, null)
    const sooner = release(3, '2026-12-22T22:00:00Z')

    expect(datedReleases([later, undated, sooner]).map((r) => r.id)).toEqual([3, 1])
  })
})

describe('splitByToday', () => {
  it('keeps upcoming soonest first and available newest first', () => {
    const dated = datedReleases([
      release(1, '2026-03-26T00:00:00Z'),
      release(2, '2026-07-16T00:00:00Z'),
      release(3, '2026-12-22T00:00:00Z'),
      release(4, '2027-04-14T00:00:00Z'),
    ])
    const { upcoming, available } = splitByToday(dated, NOW)

    expect(upcoming.map((r) => r.id)).toEqual([3, 4])
    expect(available.map((r) => r.id)).toEqual([2, 1])
  })

  it('counts a release as out once its instant has passed', () => {
    const { upcoming, available } = splitByToday(
      datedReleases([release(1, '2026-10-05T11:00:00Z'), release(2, '2026-10-05T13:00:00Z')]),
      NOW
    )
    expect(available.map((r) => r.id)).toEqual([1])
    expect(upcoming.map((r) => r.id)).toEqual([2])
  })
})

describe('rarityGroups', () => {
  it('groups ★3, ★2, ★1 and leaves out empty groups', () => {
    const groups = rarityGroups([uma(1, 3), uma(2, 1), uma(3, 3)])

    expect(groups.map((g) => g.rarity)).toEqual([3, 1])
    expect(groups[0].umas.map((u) => u.id)).toEqual([1, 3])
  })
})

describe('grindFinish (the worked example)', () => {
  it('a batch still to come counts from its own date', () => {
    const start = day('2027-04-14')
    const withEvent = grindFinish({ start, now: NOW, held: 80, ...DEFAULTS })
    const fromZero = grindFinish({ start, now: NOW, held: 0, ...DEFAULTS })

    expect(withEvent.days).toBe(70)
    expect(withEvent.finish).toEqual(day('2027-06-22'))
    expect(fromZero.days).toBe(150)
    expect(fromZero.finish).toEqual(day('2027-09-10'))
  })

  it('a batch already out counts from today', () => {
    const start = day('2026-03-26')
    const today = day('2026-10-05')
    const withEvent = grindFinish({ start, now: today, held: 80, ...DEFAULTS })
    const fromZero = grindFinish({ start, now: today, held: 0, ...DEFAULTS })

    expect(withEvent.finish).toEqual(day('2026-12-13'))
    expect(fromZero.finish).toEqual(day('2027-03-03'))
  })

  it('the first race is day 1, so a one-day grind finishes on the start', () => {
    const start = day('2027-04-14')
    expect(grindFinish({ start, now: NOW, held: 149, ...DEFAULTS })).toEqual({
      days: 1,
      finish: start,
    })
  })

  it('needs no days when the pieces already reach the goal', () => {
    expect(grindFinish({ start: day('2027-04-14'), now: NOW, held: 160, ...DEFAULTS })).toEqual({
      days: 0,
      finish: null,
    })
  })

  it('rounds up when a race gives more than one piece', () => {
    // 70 pieces at 3 a day: 23 days leaves 1 short, so 24.
    expect(
      grindFinish({ start: day('2027-04-14'), now: NOW, held: 80, goal: 150, perDay: 3 }).days
    ).toBe(24)
  })

  it('never divides by zero', () => {
    expect(
      grindFinish({ start: day('2027-04-14'), now: NOW, held: 0, goal: 150, perDay: 0 }).days
    ).toBe(150)
  })
})

describe('arrivalCountdown', () => {
  it('counts calendar days', () => {
    expect(arrivalCountdown(new Date(2026, 9, 5, 23), new Date(2026, 9, 5, 1))).toBe('today')
    expect(arrivalCountdown(new Date(2026, 9, 6, 1), new Date(2026, 9, 5, 23))).toBe('tomorrow')
    expect(arrivalCountdown(new Date(2026, 9, 17), new Date(2026, 9, 5))).toBe('in 12 days')
  })
})

describe('releaseByUmaId', () => {
  it('maps each uma to the release it joins', () => {
    const first = release(1, '2026-03-26T00:00:00Z', [uma(10, 3), uma(11, 2)])
    const second = release(2, '2026-12-22T00:00:00Z', [uma(12, 3)])
    const byUma = releaseByUmaId(datedReleases([first, second]))

    expect(byUma.get(11)?.id).toBe(1)
    expect(byUma.get(12)?.id).toBe(2)
    expect(byUma.has(99)).toBe(false)
  })
})

describe('legendRacesByBanner', () => {
  it('keys dated releases by their banner and skips the undated', () => {
    const linked = { ...release(1, '2026-12-22T22:00:00Z'), banner_timeline: 75 }
    const unlinked = { ...release(2, null), banner_timeline: null }
    // An API from before the banner id was sent: dated, but nowhere to put it.
    const oldShape = release(3, '2027-01-01T00:00:00Z')
    const byBanner = legendRacesByBanner([linked, unlinked, oldShape])

    expect([...byBanner.keys()]).toEqual([75])
    expect(byBanner.get(75)?.map((r) => r.id)).toEqual([1])
  })
})
