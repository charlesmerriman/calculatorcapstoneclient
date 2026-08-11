import { describe, it, expect } from 'vitest'
import {
  countRaceEvents,
  cumulativeEventRewards,
  cumulativeThroughoutCarats,
  parseLedger,
} from '../utils/incomeLedger'
import { THROUGHOUT_FILTER_GRACE_DAYS } from '../constants/gameConstants'
import { addUtcDays } from '../utils/utcDates'
import type { IncomeLedgerRow, LedgerRowKind } from '../types/ledger'

const utc = (iso: string) => new Date(iso)
const NOW = utc('2026-08-11T09:00:00Z')
const TODAY = utc('2026-08-11T00:00:00Z')

function row(
  overrides: Partial<IncomeLedgerRow> & { date: string; kind: LedgerRowKind }
): IncomeLedgerRow {
  return {
    source_id: 1,
    name: 'Row',
    is_predicted: false,
    throughout_end: null,
    carats: 0,
    carats_throughout: 0,
    uma_tickets: 0,
    support_tickets: 0,
    ssr_shards: 0,
    ssr_crystals: 0,
    sr_shards: 0,
    sr_crystals: 0,
    ...overrides,
  }
}

describe('cumulativeEventRewards', () => {
  it('totals lump rewards for events between now and the end date', () => {
    const ledger = parseLedger([
      row({ date: '2026-08-15T22:00:00Z', kind: 'event', carats: 1200, uma_tickets: 3 }),
      row({ date: '2026-08-20T22:00:00Z', kind: 'event', carats: 800, ssr_shards: 5 }),
    ])
    const total = cumulativeEventRewards(ledger, NOW, utc('2026-08-31T00:00:00Z'))
    expect(total.carats).toBe(2000)
    expect(total.umaTickets).toBe(3)
    expect(total.ssrShards).toBe(5)
  })

  it('excludes an event that already opened earlier today', () => {
    // The lower bound is NOW, not midnight: those carats have already paid out
    // and are in the balance the user typed in. Counting them would double them.
    const ledger = parseLedger([
      row({ date: '2026-08-11T06:00:00Z', kind: 'event', carats: 1200 }),
    ])
    expect(cumulativeEventRewards(ledger, NOW, utc('2026-12-01T00:00:00Z')).carats).toBe(0)
  })

  it('excludes events beyond the end date', () => {
    const ledger = parseLedger([
      row({ date: '2026-09-15T22:00:00Z', kind: 'event', carats: 1200 }),
    ])
    expect(cumulativeEventRewards(ledger, NOW, utc('2026-09-01T00:00:00Z')).carats).toBe(0)
  })

  it('ignores race rows and the throughout pool', () => {
    // carats_throughout is a pool spread by the decay curve, not a lump — it is
    // handled by cumulativeThroughoutCarats and must not be counted twice.
    const ledger = parseLedger([
      row({ date: '2026-08-15T22:00:00Z', kind: 'event', carats_throughout: 5000 }),
      row({ date: '2026-08-15T22:00:00Z', kind: 'champions_meeting', carats: 9999 }),
    ])
    expect(cumulativeEventRewards(ledger, NOW, utc('2026-12-01T00:00:00Z')).carats).toBe(0)
  })
})

describe('countRaceEvents', () => {
  it('counts events of the requested kind up to the end date', () => {
    const ledger = parseLedger([
      row({ date: '2026-08-26T00:00:00Z', kind: 'champions_meeting' }),
      row({ date: '2026-09-26T00:00:00Z', kind: 'champions_meeting' }),
      row({ date: '2026-08-28T00:00:00Z', kind: 'league_of_heroes' }),
    ])
    expect(countRaceEvents(ledger, 'champions_meeting', TODAY, utc('2026-09-01T00:00:00Z'))).toBe(1)
    expect(countRaceEvents(ledger, 'league_of_heroes', TODAY, utc('2026-09-01T00:00:00Z'))).toBe(1)
    expect(countRaceEvents(ledger, 'champions_meeting', TODAY, utc('2026-10-01T00:00:00Z'))).toBe(2)
  })

  it('excludes race events already in the past', () => {
    // The ledger carries past rows deliberately; the today-gate lives here.
    const ledger = parseLedger([
      row({ date: '2020-01-08T00:00:00Z', kind: 'champions_meeting' }),
    ])
    expect(countRaceEvents(ledger, 'champions_meeting', TODAY, utc('2029-01-01T00:00:00Z'))).toBe(0)
  })

  it('includes a race event finishing the day after the banner closes', () => {
    // The sheet's upper bound is `< end + 1 day`, not `<= end`. Race rows are
    // dated at midnight while banners end at 21:59:59, so this is the ported
    // behaviour rather than an off-by-one.
    const ledger = parseLedger([
      row({ date: '2026-09-02T00:00:00Z', kind: 'champions_meeting' }),
    ])
    const bannerEnd = utc('2026-09-01T21:59:59Z')
    expect(countRaceEvents(ledger, 'champions_meeting', TODAY, bannerEnd)).toBe(1)
  })
})

describe('cumulativeThroughoutCarats', () => {
  const throughoutRow = (start: string, bannerEnd: string, pool: number) =>
    row({
      date: start,
      kind: 'event',
      carats_throughout: pool,
      throughout_end: bannerEnd,
    })

  it('credits a whole pool to one checkpoint rather than splitting it', () => {
    const ledger = parseLedger([
      throughoutRow('2026-08-20T22:00:00Z', '2026-09-05T21:59:59Z', 1000),
    ])
    const early = cumulativeThroughoutCarats(ledger, NOW, utc('2026-09-10T00:00:00Z'))
    const later = cumulativeThroughoutCarats(ledger, NOW, utc('2026-12-01T00:00:00Z'))
    // Once the banner is inside the grace window it contributes its full
    // remaining amount; extending the end date adds nothing more.
    expect(early).toBeGreaterThan(0)
    expect(later).toBe(early)
  })

  it('drops a banner that has already finished', () => {
    const ledger = parseLedger([
      throughoutRow('2026-06-01T22:00:00Z', '2026-06-15T21:59:59Z', 1000),
    ])
    expect(cumulativeThroughoutCarats(ledger, NOW, utc('2026-12-01T00:00:00Z'))).toBe(0)
  })

  it('does not credit a banner ending beyond the grace window', () => {
    const bannerEnd = utc('2026-10-01T21:59:59Z')
    const ledger = parseLedger([
      throughoutRow('2026-09-20T22:00:00Z', bannerEnd.toISOString(), 1000),
    ])
    const justInside = addUtcDays(bannerEnd, -THROUGHOUT_FILTER_GRACE_DAYS)
    expect(
      cumulativeThroughoutCarats(ledger, NOW, addUtcDays(justInside, -1))
    ).toBe(0)
    expect(cumulativeThroughoutCarats(ledger, NOW, justInside)).toBeGreaterThan(0)
  })

  it('front-loads: a banner still to open has its whole pool left', () => {
    const ledger = parseLedger([
      throughoutRow('2026-11-01T22:00:00Z', '2026-11-15T21:59:59Z', 1000),
    ])
    expect(cumulativeThroughoutCarats(ledger, NOW, utc('2026-12-01T00:00:00Z'))).toBe(1000)
  })

  it('ignores rows carrying no pool', () => {
    const ledger = parseLedger([
      row({ date: '2026-08-20T22:00:00Z', kind: 'event', carats: 5000 }),
    ])
    expect(cumulativeThroughoutCarats(ledger, NOW, utc('2026-12-01T00:00:00Z'))).toBe(0)
  })
})
