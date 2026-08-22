import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { PlannerSectionBand } from '../components/carat-calculator/PlannerSectionBand'
import type { PlannerMarker } from '../utils/plannerSections'

/**
 * The band's fill rule: one fill means one date.
 *
 * A band collapses markers by insertion POINT, not by date, so it can hold two
 * lines that are the same moment (a scenario launching the day an anniversary
 * lands) or two that aren't. Alternating per line would split a shared moment
 * across two colours, saying "two dates" where there is one.
 *
 * The assertions compare tones by EQUALITY rather than naming a class, so the
 * palette can be restyled without rewriting the test — what matters is which
 * lines match each other, not which gray they landed on.
 */

function marker(
	key: string,
	kind: PlannerMarker['kind'],
	name: string,
	startDate: string
): PlannerMarker {
	// sourceId only has to be unique enough to build a link from — these tests
	// assert fills and icons, not hrefs.
	return { key, kind, sourceId: 1, name, startDate, bannerTimelineId: null }
}

/** The fill utility on each strip, in visual order. */
function tones(container: HTMLElement): string[] {
	// Strips are the band's direct children; the fill is the only bg-* class on them.
	return Array.from(container.firstElementChild!.children).map((strip) => {
		const fill = Array.from(strip.classList).find((c) => c.startsWith('bg-'))
		return fill ?? ''
	})
}

describe('PlannerSectionBand strip fills', () => {
	it('gives two markers on the same date the same fill', () => {
		const { container } = render(
			<PlannerSectionBand
				markers={[
					marker('scenario-1', 'scenario', 'Mecha', '2028-03-01T00:00:00Z'),
					marker('anniversary-1', 'anniversary', '4th Anniversary', '2028-03-01T00:00:00Z'),
				]}
			/>,
			{ wrapper: MemoryRouter }
		)
		const [first, second] = tones(container)
		expect(first).toBeTruthy()
		expect(second).toBe(first)
	})

	it('alternates the fill when the date changes', () => {
		const { container } = render(
			<PlannerSectionBand
				markers={[
					marker('scenario-1', 'scenario', 'Mecha', '2028-03-01T00:00:00Z'),
					marker('anniversary-1', 'anniversary', '4th Anniversary', '2028-03-08T00:00:00Z'),
				]}
			/>,
			{ wrapper: MemoryRouter }
		)
		const [first, second] = tones(container)
		expect(second).not.toBe(first)
	})

	it('groups by UTC day, not by raw instant', () => {
		// Same calendar day, different times — the band prints a day, so these are
		// one date as far as the reader is concerned.
		const { container } = render(
			<PlannerSectionBand
				markers={[
					marker('scenario-1', 'scenario', 'Mecha', '2028-03-01T00:00:00Z'),
					marker('anniversary-1', 'anniversary', '4th Anniversary', '2028-03-01T15:00:00Z'),
				]}
			/>,
			{ wrapper: MemoryRouter }
		)
		const [first, second] = tones(container)
		expect(second).toBe(first)
	})

	it('runs same-date groups together and alternates between them', () => {
		const { container } = render(
			<PlannerSectionBand
				markers={[
					marker('scenario-1', 'scenario', 'Mecha', '2028-03-01T00:00:00Z'),
					marker('anniversary-1', 'anniversary', '4th Anniversary', '2028-03-01T00:00:00Z'),
					marker('anniversary-2', 'anniversary', 'New Years', '2028-03-08T00:00:00Z'),
				]}
			/>,
			{ wrapper: MemoryRouter }
		)
		const [a, b, c] = tones(container)
		expect(b).toBe(a)
		expect(c).not.toBe(a)
	})

	it('draws no icon on a scenario line and one on an anniversary', () => {
		const { container } = render(
			<PlannerSectionBand
				markers={[
					marker('scenario-1', 'scenario', 'Mecha', '2028-03-01T00:00:00Z'),
					marker('anniversary-1', 'anniversary', '4th Anniversary', '2028-03-08T00:00:00Z'),
				]}
			/>,
			{ wrapper: MemoryRouter }
		)
		const strips = Array.from(container.firstElementChild!.children)
		expect(strips[0].querySelector('svg')).toBeNull()
		expect(strips[1].querySelector('svg')).not.toBeNull()
	})
})
