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
	AttachedAnniversaryEvent,
	BannerCategory,
	BannerTimelineForViewing,
	RaceEvent,
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

/**
 * A React key that survives re-filtering and can't collide across row kinds.
 *
 * Ids are unique only within a model, so a bare id would let Champions Meeting
 * 4 and a banner window share a key. Banner windows key on their start date
 * rather than an id: grouping is by that date, so it is unique across the
 * list by construction, and it stays stable if the API reorders the banners
 * within a group.
 */
export function timelineRowKey(row: TimelineRow): string {
	if (row.kind === "race") {
		return `${row.event.event_type === "champions_meeting" ? "cm" : "loh"}-${row.event.id}`
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
