/**
 * Sheet parity harness.
 *
 * Diffs our projection against the source spreadsheet's own per-banner figures
 * for the same plan, so drift is a failing test rather than something spotted by
 * eye months later.
 *
 * The snapshot is committed rather than fetched at test time: the sheet's
 * anchors are `NOW()`/`TODAY()`, so its figures move daily and a live fetch
 * would be non-deterministic and would fail offline. Regenerate it with
 *
 *     python backend/scripts/fetch_sheet_parity_snapshot.py --sheet-id <id>
 *
 * and review the diff as part of whatever change prompted it.
 *
 * THE COMMITTED SNAPSHOT IS CURRENTLY EMPTY. It comes from the sheet's PUBLIC
 * TEMPLATE, which ships with no plan configured — no banners selected, no pull
 * counts — so there are no figures to compare and the comparison below skips.
 * Pointing the fetcher at a copy with a real plan in it is what turns this from
 * a shape check into an actual parity check.
 */

import { describe, it, expect } from 'vitest'
import snapshot from './fixtures/sheetParitySnapshot.json'

interface SheetBanner {
  index: number
  type: string
  name: string
  pulls: number
  start_date: string
  end_date: string
  carat_est: number | null
  paid_carat_est: number | null
  max_pulls: number | null
}

const banners = snapshot.banners as SheetBanner[]

describe('sheet parity snapshot', () => {
  it('carries the settings block the scenario is built from', () => {
    // Guards the fixture itself: a fetcher change that silently stopped
    // capturing settings would otherwise leave the comparison below reproducing
    // the wrong scenario and still passing.
    const { settings } = snapshot
    expect(settings.server).toBe('Global')
    expect(settings.today_utc).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    for (const key of [
      'team_trials_rank',
      'club_rank',
      'champions_meeting_rank',
      'league_of_heroes_rank',
      'training_pass',
      'current_carat',
    ] as const) {
      expect(settings[key], `settings.${key} missing from the snapshot`).toBeTruthy()
    }
  })

  it('records which sheet it came from, so a stale fixture is traceable', () => {
    expect(snapshot.sheet_id).toBeTruthy()
    expect(snapshot.fetched_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it.runIf(banners.length > 0)(
    'gives every captured banner the three figures the site also shows',
    () => {
      for (const banner of banners) {
        expect(banner.carat_est, `banner ${banner.index} has no Carat Est.`).not.toBeNull()
        expect(banner.max_pulls, `banner ${banner.index} has no Max Pulls`).not.toBeNull()
        expect(banner.end_date, `banner ${banner.index} has no end date`).toBeTruthy()
      }
    }
  )
})

// The per-banner diff itself needs a snapshot with a plan in it AND a matching
// capture of our own /calculator-data for the same day (the ledger and rank
// rows the engine reads). Both are pending a configured sheet; see the file
// header. Kept as an explicit skip rather than omitted so the gap is visible in
// the test output instead of being silently absent.
describe.skip('per-banner parity', () => {
  it('matches the sheet on Carat Est., Paid Carat Est. and Max Pulls', () => {
    expect.unreachable('needs a configured sheet snapshot')
  })
})
