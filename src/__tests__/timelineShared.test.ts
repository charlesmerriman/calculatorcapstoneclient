import { describe, it, expect } from 'vitest'
import {
  groupTimelineEvents,
  timelineRowKey,
} from '../components/timeline/timelineShared'
import type { BannerWindowGroup, TimelineRow } from '../components/timeline/timelineShared'
import type { BannerTimelineForViewing, ChampionsMeeting, TimelineEvent } from '../types'

/**
 * Window grouping is what lets concurrent banners — most visibly the Golden
 * Week revivals — render as one timeline card while staying separate rows in
 * the database. The rule is deliberately narrow (identical start_date), so
 * these tests are mostly about what it must NOT sweep up.
 */

function banner(
  id: number,
  start: string,
  end: string,
  overrides: Partial<BannerTimelineForViewing> = {},
): BannerTimelineForViewing {
  return {
    id,
    name: `Banner ${id}`,
    banner_category: 'standard',
    event_type: 'banner_timeline',
    start_date: start,
    end_date: end,
    is_predicted: false,
    jp_start_date: null,
    jp_end_date: null,
    global_start_date: start,
    global_end_date: end,
    schedule_offset_days: 0,
    applied_offset_days: 0,
    image: null,
    banner_umas: [],
    banner_supports: [],
    anniversary_event: null,
    ...overrides,
  }
}

function raceEvent(id: number, start: string): ChampionsMeeting {
  return {
    id,
    name: `Champions Meeting ${id}`,
    event_type: 'champions_meeting',
    cm_number: id,
    start_date: start,
    end_date: start,
    is_predicted: false,
    jp_start_date: null,
    jp_end_date: null,
    global_start_date: start,
    global_end_date: start,
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

/** The groups from a row list, in order. */
function groups(rows: TimelineRow[]): BannerWindowGroup[] {
  return rows.flatMap((row) => (row.kind === 'banner_window' ? [row.group] : []))
}

describe('groupTimelineEvents', () => {
  it('folds banners that open at the same instant into one row', () => {
    // The 2026 Golden Week shape: a revival and an ordinary banner opening
    // together and ending together.
    const rows = groupTimelineEvents([
      banner(189, '2029-03-09T19:30:14.400000Z', '2029-03-20T19:30:13.400000Z'),
      banner(190, '2029-03-09T19:30:14.400000Z', '2029-03-20T19:30:13.400000Z'),
    ])

    expect(rows).toHaveLength(1)
    expect(groups(rows)[0].banners.map((b) => b.id)).toEqual([189, 190])
  })

  it('leaves banners with different start dates as separate rows', () => {
    const rows = groupTimelineEvents([
      banner(1, '2029-01-01T00:00:00Z', '2029-01-08T00:00:00Z'),
      banner(2, '2029-01-08T00:00:00Z', '2029-01-15T00:00:00Z'),
    ])

    expect(rows).toHaveLength(2)
  })

  it('does not group on the calendar day alone', () => {
    // Same UTC day, different instants. Merging these would put two banners a
    // reader sees as separate openings onto one card — and west of GMT they
    // may not even fall on the same local date.
    const rows = groupTimelineEvents([
      banner(1, '2029-01-01T01:00:00Z', '2029-01-08T00:00:00Z'),
      banner(2, '2029-01-01T22:00:00Z', '2029-01-08T00:00:00Z'),
    ])

    expect(rows).toHaveLength(2)
  })

  it('states the union window when the constituents end on different days', () => {
    // The real 2025 Golden Week: the revival runs nine days past the standard
    // banner it opened alongside.
    const rows = groupTimelineEvents([
      banner(129, '2028-06-17T10:51:50.400000Z', '2028-06-29T10:51:49.400000Z'),
      banner(171, '2028-06-17T10:51:50.400000Z', '2028-07-08T10:51:49.400000Z'),
    ])

    const [group] = groups(rows)
    expect(group.start_date).toBe('2028-06-17T10:51:50.400000Z')
    expect(group.end_date).toBe('2028-07-08T10:51:49.400000Z')
  })

  it('keeps the union end date when the longer banner comes first', () => {
    // Guards the comparison itself: taking the last-seen end date would pass
    // the test above by accident and fail here.
    const rows = groupTimelineEvents([
      banner(171, '2028-06-17T00:00:00Z', '2028-07-08T00:00:00Z'),
      banner(129, '2028-06-17T00:00:00Z', '2028-06-29T00:00:00Z'),
    ])

    expect(groups(rows)[0].end_date).toBe('2028-07-08T00:00:00Z')
  })

  it('flags the group as predicted if any constituent still is', () => {
    const rows = groupTimelineEvents([
      banner(1, '2029-01-01T00:00:00Z', '2029-01-08T00:00:00Z'),
      banner(2, '2029-01-01T00:00:00Z', '2029-01-08T00:00:00Z', { is_predicted: true }),
    ])

    expect(groups(rows)[0].is_predicted).toBe(true)
  })

  it('never folds race events into a window, even on a shared start date', () => {
    // Champions Meetings run concurrently with banners all the time. They are a
    // separate union member with their own card and must pass straight through.
    const start = '2029-01-01T00:00:00Z'
    const rows = groupTimelineEvents([
      banner(1, start, '2029-01-08T00:00:00Z'),
      raceEvent(1, start),
      banner(2, start, '2029-01-08T00:00:00Z'),
    ])

    expect(rows.map((row) => row.kind)).toEqual(['banner_window', 'race'])
    expect(groups(rows)[0].banners.map((b) => b.id)).toEqual([1, 2])
  })

  it('keeps the group where its first constituent sat, preserving the sort', () => {
    const rows = groupTimelineEvents([
      banner(1, '2029-01-01T00:00:00Z', '2029-01-08T00:00:00Z'),
      banner(2, '2029-02-01T00:00:00Z', '2029-02-08T00:00:00Z'),
      // Opens with banner 1 but arrives last — the group must not jump to the end.
      banner(3, '2029-01-01T00:00:00Z', '2029-01-08T00:00:00Z'),
    ])

    expect(groups(rows).map((g) => g.start_date)).toEqual([
      '2029-01-01T00:00:00Z',
      '2029-02-01T00:00:00Z',
    ])
    expect(groups(rows)[0].banners.map((b) => b.id)).toEqual([1, 3])
  })

  it('takes the campaign from whichever constituent carries one', () => {
    const campaign = {
      id: 7,
      name: '3rd Anniversary',
      event_type: 'anniversary',
    } as BannerTimelineForViewing['anniversary_event']

    const rows = groupTimelineEvents([
      banner(1, '2029-01-01T00:00:00Z', '2029-01-08T00:00:00Z'),
      banner(2, '2029-01-01T00:00:00Z', '2029-01-08T00:00:00Z', { anniversary_event: campaign }),
    ])

    // The strip renders above the whole card, so a group can only show one.
    expect(groups(rows)[0].anniversary_event).toBe(campaign)
  })

  it('passes a lone banner through unchanged, as a group of one', () => {
    const only = banner(1, '2029-01-01T00:00:00Z', '2029-01-08T00:00:00Z')
    const [group] = groups(groupTimelineEvents([only]))

    expect(group.banners).toEqual([only])
    expect(group.start_date).toBe(only.start_date)
    expect(group.end_date).toBe(only.end_date)
  })

  it('returns nothing for an empty list rather than an empty group', () => {
    expect(groupTimelineEvents([])).toEqual([])
  })
})

describe('timelineRowKey', () => {
  it('cannot collide between a race event and a banner window', () => {
    const events: TimelineEvent[] = [
      banner(4, '2029-01-01T00:00:00Z', '2029-01-08T00:00:00Z'),
      raceEvent(4, '2029-02-01T00:00:00Z'),
    ]
    const keys = groupTimelineEvents(events).map(timelineRowKey)

    expect(new Set(keys).size).toBe(2)
  })

  it('is stable when the API reorders the banners inside a group', () => {
    const start = '2029-01-01T00:00:00Z'
    const end = '2029-01-08T00:00:00Z'
    const one = banner(1, start, end)
    const two = banner(2, start, end)

    // Keying on the first banner's id would change here; keying on the shared
    // start date — which is the group's identity — does not.
    expect(timelineRowKey(groupTimelineEvents([one, two])[0])).toBe(
      timelineRowKey(groupTimelineEvents([two, one])[0]),
    )
  })
})
