import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { RaceEventCard } from '../components/timeline/RaceEventCard'
import { isRaceEvent, isBannerTimeline } from '../types'
import type {
  ChampionsMeeting,
  LeagueOfHeroes,
  BannerTimelineForViewing,
  TimelineEvent,
} from '../types'

/**
 * Champions Meetings and League of Heroes events are meant to be the same card.
 *
 * The strongest way to hold that is to render one of each from the same data and
 * diff the markup — a divergence introduced by editing one branch and not the
 * other shows up here as a failing DOM comparison, which is exactly the failure
 * that extracting RaceEventCard was meant to make impossible.
 */

const TODAY = new Date('2099-01-01T00:00:00Z')

const courseAndStats = {
  start_date: '2099-01-10T00:00:00Z',
  end_date: '2099-01-17T00:00:00Z',
  is_predicted: false,
  jp_start_date: null,
  jp_end_date: null,
  global_start_date: '2099-01-10T00:00:00Z',
  global_end_date: '2099-01-17T00:00:00Z',
  schedule_offset_days: 0,
  applied_offset_days: 0,
  image: null,
  track: 'Nakayama',
  surface_type: 'Turf',
  distance: 'Medium',
  length: '2000m',
  track_condition: 'Firm',
  season: 'Autumn',
  weather: 'Cloudy',
  direction: 'Right',
  speed_recommendation: '1100',
  stamina_recommendation: '900',
  power_recommendation: '1000',
  guts_recommendation: '400',
  wit_recommendation: '700',
} as const

const championsMeeting: ChampionsMeeting = {
  id: 1,
  name: 'Race Event',
  event_type: 'champions_meeting',
  cm_number: 1,
  ...courseAndStats,
}

const leagueOfHeroes: LeagueOfHeroes = {
  id: 1,
  name: 'Race Event',
  event_type: 'league_of_heroes',
  loh_number: 1,
  ...courseAndStats,
}

/** The same event with every course/stat field left at the backend's sentinels. */
const unannouncedLoh: LeagueOfHeroes = {
  ...leagueOfHeroes,
  track: 'TBD',
  surface_type: 'TBD',
  distance: 'TBD',
  length: 'TBD',
  track_condition: 'TBD',
  season: 'TBD',
  weather: 'TBD',
  direction: 'TBD',
  speed_recommendation: '0',
  stamina_recommendation: '0',
  power_recommendation: '0',
  guts_recommendation: '0',
  wit_recommendation: '0',
}

describe('RaceEventCard', () => {
  it('renders a League of Heroes event identically to a Champions Meeting', () => {
    const { container: cmContainer } = render(
      <RaceEventCard event={championsMeeting} today={TODAY} />,
    )
    const cmMarkup = cmContainer.innerHTML

    const { container: lohContainer } = render(
      <RaceEventCard event={leagueOfHeroes} today={TODAY} />,
    )

    expect(lohContainer.innerHTML).toBe(cmMarkup)
  })

  it('shows course details without stat recommendations for a League of Heroes event', () => {
    render(<RaceEventCard event={leagueOfHeroes} today={TODAY} />)

    expect(screen.getByText('Course details')).toBeTruthy()
    expect(screen.getByText('Nakayama')).toBeTruthy()
    expect(screen.queryByText('Recommended stats')).toBeNull()
    expect(screen.queryByText('1100')).toBeNull()
  })

  it('falls back to the pending state when a League of Heroes event is unannounced', () => {
    render(<RaceEventCard event={unannouncedLoh} today={TODAY} />)

    // Every course slot is a sentinel, so no details have anything to show and the
    // card collapses to art-only with the "coming soon" notice.
    expect(screen.queryByText('Course details')).toBeNull()
    expect(screen.queryByText('Recommended stats')).toBeNull()
    expect(
      screen.getByText('Some course details are coming soon.'),
    ).toBeTruthy()
  })
})

describe('timeline event narrowing', () => {
  const bannerWindow: BannerTimelineForViewing = {
    id: 1,
    name: 'Window',
    banner_category: 'standard',
    event_type: 'banner_timeline',
    start_date: '2099-01-10T00:00:00Z',
    end_date: '2099-01-17T00:00:00Z',
    is_predicted: false,
    jp_start_date: null,
    jp_end_date: null,
    global_start_date: '2099-01-10T00:00:00Z',
    global_end_date: '2099-01-17T00:00:00Z',
    schedule_offset_days: 0,
    applied_offset_days: 0,
    image: null,
    banner_umas: [],
    banner_supports: [], anniversary_event: null,
  }

  // A banner window shares every base field with both race types, so a
  // structural check ("track" in event / "banner_umas" in event) could sort it
  // wrongly the moment shapes converge. The tag can't.
  it('sorts each of the three event types to exactly one branch', () => {
    const events: TimelineEvent[] = [championsMeeting, leagueOfHeroes, bannerWindow]

    expect(events.filter(isRaceEvent)).toEqual([championsMeeting, leagueOfHeroes])
    expect(events.filter(isBannerTimeline)).toEqual([bannerWindow])
  })
})
