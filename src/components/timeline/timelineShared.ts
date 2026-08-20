/**
 * Logic the timeline's banner card and race card both need.
 *
 * Split out of Timeline.tsx when the Champions Meeting card was generalised into
 * RaceEventCard — leaving it in Timeline.tsx would have made the card module
 * import from its own parent. Kept as a plain `.ts` module (no JSX, components
 * live in their own files) so React Fast Refresh isn't disabled here.
 */

import { differenceInCalendarDays } from "date-fns"
import { parseApiDate } from "../../utils/dateFormat"
import { isRaceEvent } from "../../types"
import type {
	AnniversaryEvent,
	AttachedAnniversaryEvent,
	BannerCategory,
	BannerTimelineForViewing,
	RaceEvent,
	Scenario,
	TimelineEvent,
} from "../../types"

// Countdown label for the badge in a card's header. Both dates are parsed
// through parseApiDate so date-only strings land on *local* midnight —
// `new Date("2026-08-10")` would parse as UTC and shift the day count by one
// for anyone west of GMT. Comparing calendar days (not elapsed hours) means an
// event starting later today reads "Starts today" rather than "in 0 days".
export function getCountdownLabel(startDate: string, endDate: string, today: Date): string {
	const start = parseApiDate(startDate)
	const end = parseApiDate(endDate)
	if (!start || !end) return ""

	const daysUntilStart = differenceInCalendarDays(start, today)
	if (daysUntilStart > 1) return `In ${daysUntilStart} Days`
	if (daysUntilStart === 1) return "Starts Tomorrow"
	if (daysUntilStart === 0) return "Starts Today"

	// Already started — the countdown flips to how much of it is left.
	const daysUntilEnd = differenceInCalendarDays(end, today)
	if (daysUntilEnd > 1) return `Ends in ${daysUntilEnd} Days`
	if (daysUntilEnd === 1) return "Ends Tomorrow"
	if (daysUntilEnd === 0) return "Ends Today"
	return "Ended"
}

/**
 * Display names for the banner categories, in the order the filter offers them.
 *
 * One source of truth because the same words appear twice — on the chip in a
 * timeline section and in the category filter's dropdown — and a reader
 * filtering for "Golden Week Revival" has to see that exact phrase on the cards
 * that come back.
 *
 * `standard` has a label even though it never renders a chip: the filter still
 * has to name it.
 */
export const CATEGORY_LABELS: Record<BannerCategory, string> = {
	standard: "Standard",
	golden_week_revival: "Golden Week Revival",
	race_prep_support: "Race Prep Support",
	rerun: "Rerun",
}

/** Filter order: the ordinary case first, then the exceptions. */
export const CATEGORY_ORDER: BannerCategory[] = [
	"standard",
	"golden_week_revival",
	"race_prep_support",
	"rerun",
]

/**
 * Banners that open at the same moment, presented as one timeline card.
 *
 * The game regularly runs two banners concurrently — most visibly the Golden
 * Week revivals, where a revival banner of up to eleven umas runs alongside an
 * ordinary two-uma banner. Our data mirrors the source sheet and stores those
 * as separate BannerTimeline rows, which is correct and must stay that way:
 * they are separate gacha pools with separate pity, UserPlannedBanner
 * foreign-keys the BannerUma rather than the timeline, and their end dates can
 * differ — and income is a pure function of a banner's end date, so collapsing
 * them in the database would move real carat numbers.
 *
 * So the merge happens here, at render time, where it costs nothing: one card,
 * one header, one panel per constituent banner, each keeping its own dates and
 * its own "Add to Planner" button.
 *
 * A group of one is the overwhelmingly common case and renders exactly as a
 * lone banner always did — the grouped path is the only path, so there is no
 * second layout to keep in sync.
 */
export interface BannerWindowGroup {
	/** The shared opening instant, and the group's identity. */
	start_date: string
	/** The LATEST end across the group, so the header states the union window. */
	end_date: string
	/** True if any constituent's dates are still an estimate. */
	is_predicted: boolean
	/** In API order. Never empty. */
	banners: BannerTimelineForViewing[]
	/**
	 * The first campaign attached to any constituent. Campaigns attach per
	 * banner, but the strip renders above the whole card, so a group can only
	 * show one — and in the data a campaign covers every banner in its window.
	 */
	anniversary_event: AttachedAnniversaryEvent | null
}

/**
 * One row of the rendered timeline: either a race event, or a window of one or
 * more concurrent banners.
 *
 * Tagged rather than shape-tested, for the same reason TimelineEvent is —
 * see the note on isRaceEvent in types/calculator.
 */
export type TimelineRow =
	| { kind: "race"; event: RaceEvent }
	| { kind: "banner_window"; group: BannerWindowGroup }
	| { kind: "marker"; marker: TimelineMarker }

/**
 * A scenario launch or a campaign opening, rendered as its own card in the
 * stream rather than attached to a banner.
 *
 * A FRONTEND row kind, not a backend union member, and deliberately so:
 * `organizedTimelineData` narrows on the backend's `event_type` tag, but
 * `AnniversaryEvent.event_type` already means something else entirely (the
 * campaign kind — anniversary / new_year / campaign). Tagging these server-side
 * would collide with a shipped field.
 *
 * `endDate` is null for a scenario and only a scenario: a scenario is released
 * and then stays available permanently, so it is a single dated instant with
 * nothing to close. Branch on that rather than on `kind` when deciding whether
 * to render a range.
 */
export interface TimelineMarker {
	/** Collision-proof across kinds; see timelineRowKey. */
	key: string
	kind: "scenario" | "anniversary"
	name: string
	startDate: string
	/** Null for scenarios — they have no end. */
	endDate: string | null
	/** Often null: art routinely lands after the row does. */
	image: string | null
	isPredicted: boolean
}

/**
 * A React key that survives re-filtering and can't collide across row kinds.
 *
 * Ids are unique only within a model, so a bare id would let Champions Meeting
 * 4 and a banner window share a key. Banner windows key on their start date
 * rather than an id: grouping is by that date, so it is unique across the
 * list by construction, and it stays stable if the API reorders the banners
 * within a group. Markers carry their own already-prefixed key.
 */
export function timelineRowKey(row: TimelineRow): string {
	if (row.kind === "race") {
		return `${row.event.event_type === "champions_meeting" ? "cm" : "loh"}-${row.event.id}`
	}
	if (row.kind === "marker") {
		return row.marker.key
	}
	return `win-${row.group.start_date}`
}

/**
 * Folds banner events that open at the same instant into one row, leaving race
 * events untouched.
 *
 * Grouping is on the exact `start_date` string, not on its calendar day. Both
 * agree on every row in production (eight groups, sixteen rows), and exact
 * equality is the stricter, unambiguous rule: two banners opening at the same
 * UTC instant are the same window for every reader, whereas a same-UTC-day test
 * could merge two banners that a reader west of GMT sees on different dates.
 *
 * Order is preserved — a group sits where its first constituent sat, so the
 * caller's sort still holds.
 *
 * Pure, and called on an already-filtered list: grouping must run AFTER the
 * past/future split, or a group could straddle the boundary and drag an ended
 * banner into the current view.
 */
export function groupTimelineEvents(events: TimelineEvent[]): TimelineRow[] {
	const rows: TimelineRow[] = []
	const groupsByStart = new Map<string, BannerWindowGroup>()

	for (const event of events) {
		if (isRaceEvent(event)) {
			rows.push({ kind: "race", event })
			continue
		}

		const existing = groupsByStart.get(event.start_date)
		if (existing) {
			existing.banners.push(event)
			// Widen the header's window to cover every constituent, and keep the
			// predicted badge if any one of them is still an estimate. ISO-8601
			// strings compare correctly with `>`, which is why the dates never
			// need parsing here.
			if (event.end_date > existing.end_date) existing.end_date = event.end_date
			existing.is_predicted ||= event.is_predicted
			existing.anniversary_event ??= event.anniversary_event
			continue
		}

		// Held in both the map and the row list on purpose — same object, so the
		// appends above are visible to the row already pushed here.
		const group: BannerWindowGroup = {
			start_date: event.start_date,
			end_date: event.end_date,
			is_predicted: event.is_predicted,
			banners: [event],
			anniversary_event: event.anniversary_event,
		}
		groupsByStart.set(event.start_date, group)
		rows.push({ kind: "banner_window", group })
	}

	return rows
}

/**
 * Caption for the step-ups running in a campaign window, e.g. "2 ★3 + 3 SSR
 * Step-Up". Returns null when there are none, so the caller renders nothing.
 *
 * Counts are summed per pool rather than listed per row: a campaign stores one
 * BannerStepUp per pool carrying how many banners it runs, and "2 ★3" is what a
 * player recognises — the individual rows have administrative names.
 *
 * ★3 and SSR are the game's own words for the two pools, and are what the
 * step-up row in the calculator shows, so the Timeline uses them too.
 */
export function formatStepUpChip(
	stepUps: { card_type: "uma" | "support"; banner_count: number }[]
): string | null {
	const totals = { uma: 0, support: 0 }
	for (const stepUp of stepUps) {
		totals[stepUp.card_type] += stepUp.banner_count
	}

	const parts: string[] = []
	if (totals.uma > 0) parts.push(`${totals.uma} ★3`)
	if (totals.support > 0) parts.push(`${totals.support} SSR`)

	return parts.length > 0 ? `${parts.join(" + ")} Step-Up` : null
}

/**
 * Turn scenarios and campaigns into timeline markers, dropping the undated.
 *
 * Undated is a normal state, not an error: a scenario with no launch banner
 * yet, or a campaign with no linked parts, has nothing to sort by and so has no
 * place in a chronological list.
 */
export function buildTimelineMarkers(
	scenarios: Scenario[],
	anniversaryEvents: AnniversaryEvent[]
): TimelineMarker[] {
	const markers: TimelineMarker[] = []

	for (const scenario of scenarios) {
		if (!scenario.start_date) continue
		markers.push({
			key: `sce-${scenario.id}`,
			kind: "scenario",
			name: scenario.name,
			startDate: scenario.start_date,
			// Not "unknown" — a scenario genuinely has no end. It stays playable
			// after release, so there is nothing here to fill in later.
			endDate: null,
			image: scenario.image,
			isPredicted: scenario.is_predicted,
		})
	}

	for (const event of anniversaryEvents) {
		if (!event.start_date) continue
		// `event_type: "campaign"` is the one-off-promotion catch-all — today only
		// the Trainer Support Pack, a permanently purchasable bundle. It marks no
		// moment on the calendar, so it gets no card, exactly as it gets no band
		// in the planner. Excluded by type, not by being undated.
		if (event.event_type === "campaign") continue
		markers.push({
			key: `ann-${event.id}`,
			kind: "anniversary",
			name: event.name,
			startDate: event.start_date,
			endDate: event.end_date,
			image: event.image,
			isPredicted: event.is_predicted,
		})
	}

	return markers
}

/**
 * Splice marker rows into an already-grouped, already-sorted row list.
 *
 * Must run AFTER groupTimelineEvents, for the same reason grouping runs after
 * filtering: it consumes the final row order and inserts against it, so running
 * earlier would let a marker land inside a window that later folds together.
 *
 * A marker sits before the first row starting at or after it, and a scenario
 * sorts above a campaign at the same instant — the same rule the calculator's
 * section bands use, so the two surfaces agree. Markers past the last row are
 * appended, unlike in the planner: the timeline is the whole calendar, so
 * there is no "between" to fall outside of.
 */
export function mergeTimelineMarkers(
	rows: TimelineRow[],
	markers: TimelineMarker[]
): TimelineRow[] {
	if (markers.length === 0) return rows

	const rowStart = (row: TimelineRow): number => {
		const iso =
			row.kind === "race" ? row.event.start_date
				: row.kind === "banner_window" ? row.group.start_date
					: row.marker.startDate
		const ms = new Date(iso).getTime()
		return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms
	}

	const pending = [...markers].sort((a, b) => {
		const byTime =
			new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
		if (byTime !== 0) return byTime
		if (a.kind !== b.kind) return a.kind === "scenario" ? -1 : 1
		return a.name.localeCompare(b.name)
	})

	const out: TimelineRow[] = []
	let next = 0
	for (const row of rows) {
		const start = rowStart(row)
		while (
			next < pending.length &&
			new Date(pending[next].startDate).getTime() <= start
		) {
			out.push({ kind: "marker", marker: pending[next] })
			next += 1
		}
		out.push(row)
	}
	for (; next < pending.length; next += 1) {
		out.push({ kind: "marker", marker: pending[next] })
	}
	return out
}
