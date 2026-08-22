import { describe, it, expect } from 'vitest'
import { buildPlannerRows } from '../utils/plannerSections'
import type { PlannerRow } from '../utils/plannerSections'
import type { AnniversaryEvent, Scenario, UserPlannedBanner } from '../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * A planned Uma row on a banner opening at `start`, with timeline id `id`.
 * Only the fields buildPlannerRows reads are populated — it goes through
 * plannedBannerTimeline, which needs the banner_uma.banner_timeline chain.
 */
function row(id: number, start: string): UserPlannedBanner {
	return {
		id,
		number_of_pulls: 0,
		banner_uma: {
			id,
			name: `Banner ${id}`,
			free_pulls: 0,
			banner_timeline: {
				id,
				name: `Timeline ${id}`,
				start_date: start,
				end_date: start,
				is_predicted: false,
			},
		},
		banner_support: null,
		banner_step_up: null,
	} as unknown as UserPlannedBanner
}

function scenario(
	id: number,
	name: string,
	start: string | null,
	bannerTimeline: number | null = null
): Scenario {
	return {
		id,
		name,
		image: null,
		banner_timeline: bannerTimeline,
		start_date: start,
		is_predicted: false,
		applied_offset_days: 0,
	}
}

function anniversary(
	id: number,
	name: string,
	start: string | null,
	eventType: AnniversaryEvent['event_type'] = 'anniversary',
	// Defaults to the opening date, which is exactly what the backend resolves
	// for a campaign with no separate main part. Pass it to model an anniversary
	// whose Part 1 run-up opens before the anniversary itself.
	mainStart: string | null = start
): AnniversaryEvent {
	return {
		id,
		name,
		event_type: eventType,
		jp_cutoff_date: null,
		image: null,
		accent_label: '',
		start_date: start,
		main_start_date: mainStart,
		end_date: start,
		is_predicted: false,
		applied_offset_days: 0,
		products: [],
		banner_parts: [],
	}
}

/** Compact shape of the result, for readable assertions. */
function shape(rows: PlannerRow[]): string[] {
	return rows.map((r) =>
		r.kind === 'banner'
			? `row:${r.banner.id}@${r.index}`
			: `band:${r.markers.map((m) => m.name).join('|')}`
	)
}

// ── Bounds ────────────────────────────────────────────────────────────────────

describe('buildPlannerRows bounds', () => {
	it('adds no bands to a single row — there is no "between"', () => {
		const rows = buildPlannerRows(
			[row(1, '2028-01-01T00:00:00Z')],
			[scenario(1, 'Mecha', '2028-01-01T00:00:00Z')],
			[]
		)
		expect(shape(rows)).toEqual(['row:1@0'])
	})

	it('adds no bands to an empty sheet', () => {
		expect(buildPlannerRows([], [scenario(1, 'Mecha', '2028-01-01T00:00:00Z')], [])).toEqual([])
	})

	it('drops a marker starting before the first row, so no band opens the list', () => {
		const rows = buildPlannerRows(
			[row(1, '2028-03-01T00:00:00Z'), row(2, '2028-06-01T00:00:00Z')],
			[scenario(1, 'Too early', '2028-01-01T00:00:00Z')],
			[]
		)
		expect(shape(rows)).toEqual(['row:1@0', 'row:2@1'])
	})

	it('drops a marker starting exactly on the first row', () => {
		const rows = buildPlannerRows(
			[row(1, '2028-03-01T00:00:00Z'), row(2, '2028-06-01T00:00:00Z')],
			[],
			[anniversary(1, 'Same instant as row 1', '2028-03-01T00:00:00Z')]
		)
		expect(shape(rows)).toEqual(['row:1@0', 'row:2@1'])
	})

	it('drops a marker starting after the last row', () => {
		const rows = buildPlannerRows(
			[row(1, '2028-03-01T00:00:00Z'), row(2, '2028-06-01T00:00:00Z')],
			[scenario(1, 'Too late', '2029-01-01T00:00:00Z')],
			[]
		)
		expect(shape(rows)).toEqual(['row:1@0', 'row:2@1'])
	})

	it('ignores an undated scenario', () => {
		const rows = buildPlannerRows(
			[row(1, '2028-03-01T00:00:00Z'), row(2, '2028-06-01T00:00:00Z')],
			[scenario(1, 'No launch banner yet', null)],
			[]
		)
		expect(shape(rows)).toEqual(['row:1@0', 'row:2@1'])
	})
})

// ── Placement ─────────────────────────────────────────────────────────────────

describe('buildPlannerRows placement', () => {
	it('places an anniversary before the first row starting on or after it', () => {
		const rows = buildPlannerRows(
			[
				row(1, '2028-01-01T00:00:00Z'),
				row(2, '2028-05-01T00:00:00Z'),
				row(3, '2028-09-01T00:00:00Z'),
			],
			[],
			[anniversary(1, '4th Anniversary', '2028-04-01T00:00:00Z')]
		)
		expect(shape(rows)).toEqual([
			'row:1@0',
			'band:4th Anniversary',
			'row:2@1',
			'row:3@2',
		])
	})

	it('places an anniversary at its MAIN part, not at its Part 1 run-up', () => {
		// An anniversary opens with a Part 1 of login rewards announcing itself,
		// then the anniversary proper starts at Part 2 about ten days later. The
		// band marks the anniversary, so it must clear the run-up row.
		const rows = buildPlannerRows(
			[
				row(1, '2028-01-01T00:00:00Z'),
				row(2, '2028-04-21T00:00:00Z'), // Part 1 — Tsurumaru Tsuyoshi
				row(3, '2028-04-30T00:00:00Z'), // Part 2 — Orfevre, the anniversary
				row(4, '2028-09-01T00:00:00Z'),
			],
			[],
			[
				anniversary(
					1,
					'4th Anniversary',
					'2028-04-21T00:00:00Z',
					'anniversary',
					'2028-04-30T00:00:00Z'
				),
			]
		)
		expect(shape(rows)).toEqual([
			'row:1@0',
			'row:2@1',
			'band:4th Anniversary',
			'row:3@2',
			'row:4@3',
		])
	})

	it('falls back to the opening when a campaign has no separate main part', () => {
		// New Year campaigns and one-off promotions resolve main_start_date to the
		// same instant as start_date, so placement is unchanged for them.
		const rows = buildPlannerRows(
			[
				row(1, '2028-01-01T00:00:00Z'),
				row(2, '2028-05-01T00:00:00Z'),
			],
			[],
			[anniversary(1, 'New Years 2026', '2028-04-01T00:00:00Z', 'new_year')]
		)
		expect(shape(rows)).toEqual(['row:1@0', 'band:New Years 2026', 'row:2@1'])
	})

	it('shows a band for a campaign the user planned no banner for', () => {
		const rows = buildPlannerRows(
			[row(1, '2028-01-01T00:00:00Z'), row(2, '2028-09-01T00:00:00Z')],
			[],
			[anniversary(7, 'Unplanned campaign', '2028-05-01T00:00:00Z')]
		)
		expect(shape(rows)).toContain('band:Unplanned campaign')
	})

	it('pins a scenario above its OWN banner when another shares that start instant', () => {
		// The mockup's "Order Up! Tracen Ramen!" case: two banners open on the
		// same day and the scenario belongs to the second one.
		const rows = buildPlannerRows(
			[
				row(1, '2028-01-01T00:00:00Z'),
				row(2, '2029-03-09T00:00:00Z'),
				row(3, '2029-03-09T00:00:00Z'),
			],
			[scenario(1, 'Order Up! Tracen Ramen!', '2029-03-09T00:00:00Z', 3)],
			[]
		)
		expect(shape(rows)).toEqual([
			'row:1@0',
			'row:2@1',
			'band:Order Up! Tracen Ramen!',
			'row:3@2',
		])
	})

	it('falls back to date placement when the scenario\'s banner is not on the sheet', () => {
		const rows = buildPlannerRows(
			[row(1, '2028-01-01T00:00:00Z'), row(2, '2028-09-01T00:00:00Z')],
			[scenario(1, 'Unplanned launch', '2028-05-01T00:00:00Z', 99)],
			[]
		)
		expect(shape(rows)).toEqual(['row:1@0', 'band:Unplanned launch', 'row:2@1'])
	})
})

// ── Collapsing and ordering ───────────────────────────────────────────────────

describe('buildPlannerRows collapsing', () => {
	it('collapses markers at one point into a single band, scenario first', () => {
		const rows = buildPlannerRows(
			[row(1, '2028-01-01T00:00:00Z'), row(2, '2028-05-01T00:00:00Z')],
			[scenario(1, 'Hashire! Mecha Umamusume', '2028-04-01T00:00:00Z')],
			[anniversary(1, '3.5th Anniversary', '2028-04-01T00:00:00Z')]
		)
		expect(shape(rows)).toEqual([
			'row:1@0',
			'band:Hashire! Mecha Umamusume|3.5th Anniversary',
			'row:2@1',
		])
	})

	it('orders scenario above anniversary even when the anniversary starts first', () => {
		// Both land on the same insertion point; the tie is broken by kind only
		// after the date, so an earlier anniversary still sorts to its own line.
		const rows = buildPlannerRows(
			[row(1, '2028-01-01T00:00:00Z'), row(2, '2028-05-01T00:00:00Z')],
			[scenario(1, 'Scenario', '2028-04-02T00:00:00Z')],
			[anniversary(1, 'Anniversary', '2028-04-01T00:00:00Z')]
		)
		const band = rows.find((r) => r.kind === 'band')
		expect(band?.kind === 'band' && band.markers.map((m) => m.name)).toEqual([
			'Anniversary',
			'Scenario',
		])
	})

	it('gives a band a key derived from its markers, not its position', () => {
		const rows = buildPlannerRows(
			[row(1, '2028-01-01T00:00:00Z'), row(2, '2028-05-01T00:00:00Z')],
			[scenario(3, 'Mecha', '2028-04-01T00:00:00Z')],
			[anniversary(8, '4th', '2028-04-01T00:00:00Z')]
		)
		const band = rows.find((r) => r.kind === 'band')
		expect(band?.kind === 'band' && band.key).toBe('scenario-3+anniversary-8')
	})
})

// ── The correctness constraint ────────────────────────────────────────────────

describe('buildPlannerRows index integrity', () => {
	it('keeps each row\'s ORIGINAL index across interleaved bands', () => {
		// bannerResources is positional against userPlannedBannerData, so a band
		// that renumbers rows silently mis-attributes every row's resources.
		const banners = [
			row(1, '2028-01-01T00:00:00Z'),
			row(2, '2028-05-01T00:00:00Z'),
			row(3, '2028-09-01T00:00:00Z'),
		]
		const rows = buildPlannerRows(
			banners,
			[scenario(1, 'S', '2028-04-01T00:00:00Z')],
			[anniversary(1, 'A', '2028-08-01T00:00:00Z')]
		)

		const bannerRows = rows.filter((r) => r.kind === 'banner')
		expect(bannerRows.map((r) => r.kind === 'banner' && r.index)).toEqual([0, 1, 2])
		// And each index still points at the right banner.
		bannerRows.forEach((r) => {
			if (r.kind === 'banner') expect(banners[r.index]).toBe(r.banner)
		})
	})

	it('passes through rows whose banner has no resolvable timeline', () => {
		const empty = { id: 9, number_of_pulls: 0, banner_uma: null, banner_support: null,
			banner_step_up: null } as unknown as UserPlannedBanner
		const rows = buildPlannerRows(
			[row(1, '2028-01-01T00:00:00Z'), empty, row(2, '2028-09-01T00:00:00Z')],
			[],
			[anniversary(1, 'A', '2028-05-01T00:00:00Z')]
		)
		const bannerRows = rows.filter((r) => r.kind === 'banner')
		expect(bannerRows).toHaveLength(3)
		expect(bannerRows.map((r) => r.kind === 'banner' && r.index)).toEqual([0, 1, 2])
	})
})

// ── Campaign kinds that are not landmarks ─────────────────────────────────────

describe('buildPlannerRows campaign kinds', () => {
	const between = [row(1, '2028-01-01T00:00:00Z'), row(2, '2028-09-01T00:00:00Z')]

	it('bands an anniversary and a new year', () => {
		const rows = buildPlannerRows(between, [], [
			anniversary(1, '4th Anniversary', '2028-03-01T00:00:00Z', 'anniversary'),
			anniversary(2, 'New Years 2026', '2028-04-01T00:00:00Z', 'new_year'),
		])
		// Both fall before the same row, so they collapse into one band — the
		// point here is that a new_year is banded at all, not how it is grouped.
		expect(shape(rows).filter((s) => s.startsWith('band'))).toEqual([
			'band:4th Anniversary|New Years 2026',
		])
	})

	it('never bands a one-off promotion, even when it is dated', () => {
		// The Trainer Support Pack is a permanently purchasable bundle. Nothing
		// about the game changes when it goes on sale, so it is not a landmark —
		// and excluding it by TYPE keeps it out even if an editor links it to a
		// banner and gives it dates.
		const rows = buildPlannerRows(between, [], [
			anniversary(6, 'Trainer Support Pack', '2028-05-01T00:00:00Z', 'campaign'),
		])
		expect(shape(rows)).toEqual(['row:1@0', 'row:2@1'])
	})
})

// ── Band visibility ───────────────────────────────────────────────────────────

describe('buildPlannerRows band visibility', () => {
	const between = [row(1, '2028-01-01T00:00:00Z'), row(2, '2028-09-01T00:00:00Z')]
	// Same date, so with both kinds shown they collapse into one two-line band.
	const sameDay = '2028-03-01T00:00:00Z'
	const scenarios = [scenario(1, 'Mecha', sameDay)]
	const events = [anniversary(1, '4th Anniversary', sameDay)]

	it('shows every kind when told nothing', () => {
		const rows = buildPlannerRows(between, scenarios, events)
		expect(shape(rows).filter((s) => s.startsWith('band'))).toEqual([
			'band:Mecha|4th Anniversary',
		])
	})

	it('drops anniversaries without disturbing the scenario sharing their point', () => {
		// The regression this guards: filtering AFTER placement would leave the
		// scenario as the second line of a band whose first line is gone.
		const rows = buildPlannerRows(between, scenarios, events, {
			scenario: true,
			anniversary: false,
		})
		expect(shape(rows)).toEqual(['row:1@0', 'band:Mecha', 'row:2@1'])
	})

	it('drops scenarios', () => {
		const rows = buildPlannerRows(between, scenarios, events, {
			scenario: false,
			anniversary: true,
		})
		expect(shape(rows)).toEqual(['row:1@0', 'band:4th Anniversary', 'row:2@1'])
	})

	it('builds a bandless sheet when both kinds are hidden', () => {
		const rows = buildPlannerRows(between, scenarios, events, {
			scenario: false,
			anniversary: false,
		})
		expect(shape(rows)).toEqual(['row:1@0', 'row:2@1'])
	})

	it('leaves row indices alone whichever kinds are hidden', () => {
		// Bands are presentational; `index` is positional against the original
		// banner array and must never move because a band appeared or vanished.
		const rows = buildPlannerRows(between, scenarios, events, {
			scenario: false,
			anniversary: false,
		})
		expect(rows.map((r) => (r.kind === 'banner' ? r.index : -1))).toEqual([0, 1])
	})
})
