import { describe, it, expect } from 'vitest'
import {
  arrivalCountdown,
  datedReleases,
  legendRacesByBanner,
  rarityGroups,
  releaseByUmaId,
  splitByToday,
} from '../utils/dailyLegendRaces'
import type { DailyLegendRaceRelease, DailyLegendRaceUma } from '../types'

/**
 * The Legend Races page's rules, tested without React.
 *
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

const NOW = new Date('2026-10-05T12:00:00Z')

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
