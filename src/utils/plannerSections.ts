import type { AnniversaryEvent, Scenario, UserPlannedBanner } from "../types"
import { plannedBannerTimeline } from "./bannerHelpers"

/**
 * Section bands for the calculator's banner sheet.
 *
 * The sheet is a flat chronological list, and across two or three years of
 * planning it has no landmarks — nothing says "this is where the 4th
 * Anniversary starts" or "this is where the Mecha scenario launched". This
 * builds the render list for that sheet: the same banner rows, with full-width
 * band rows interleaved for the scenarios and anniversaries occurring between
 * the first and last planned banner.
 *
 * Purely presentational. Nothing here touches the projection, and a band
 * carries no resources of its own.
 */

/** One line inside a band. */
export interface PlannerMarker {
	/** Collision-proof across kinds; also the React key when a band has one line. */
	key: string
	kind: "scenario" | "anniversary"
	name: string
	/**
	 * ISO instant. Markers with no resolved start never become a marker at all.
	 *
	 * For an anniversary this is its `main_start_date` — where the anniversary
	 * itself falls — not the campaign's opening. See the note on that field.
	 */
	startDate: string
	/**
	 * Scenario only — the banner it launched alongside. A scenario's start date
	 * IS that banner's start date, so the band pins directly above that row
	 * rather than merely sorting near it. Null for anniversaries, which span
	 * several parts and place by date.
	 */
	bannerTimelineId: number | null
}

/**
 * A row in the rendered sheet.
 *
 * TYPESCRIPT CONCEPT: Tagged unions for heterogeneous lists
 * Same approach as TimelineRow in components/timeline/timelineShared.ts —
 * narrow on `kind`, never by sniffing which properties exist.
 *
 * `index` on a banner row is its position in the ORIGINAL userPlannedBannerData
 * array, carried through deliberately: `bannerResources` is positional against
 * that array, so a row must never be looked up by its position in THIS list.
 */
export type PlannerRow =
	| { kind: "banner"; banner: UserPlannedBanner; index: number }
	| { kind: "band"; key: string; markers: PlannerMarker[] }

/**
 * Whether a campaign is a calendar landmark worth banding.
 *
 * `anniversary` and `new_year` are dated moments the game visibly turns on.
 * `event_type: "campaign"` is the catch-all for one-off promotions — today only
 * the Trainer Support Pack, a permanently purchasable bundle. Nothing about the
 * game changes when it goes on sale, so it is not a landmark and must not
 * interrupt the sheet. Excluded by TYPE rather than by having no dates, so it
 * stays excluded if an editor ever links it to a banner.
 */
function bandsAsCampaign(event: AnniversaryEvent): boolean {
	return event.event_type !== "campaign"
}

/** Epoch millis for an ISO instant, or null when absent/unparseable. */
function startTime(iso: string | null | undefined): number | null {
	if (!iso) return null
	const ms = new Date(iso).getTime()
	return Number.isNaN(ms) ? null : ms
}

/**
 * Sort order within one insertion point: scenarios above anniversaries.
 *
 * Scenarios routinely launch alongside an anniversary, and when they collide
 * the scenario reads first because it is the larger statement — a new way to
 * play the game, versus a recurring sale.
 */
const KIND_ORDER: Record<PlannerMarker["kind"], number> = {
	scenario: 0,
	anniversary: 1,
}

function compareMarkers(a: PlannerMarker, b: PlannerMarker): number {
	const byTime = (startTime(a.startDate) ?? 0) - (startTime(b.startDate) ?? 0)
	if (byTime !== 0) return byTime
	const byKind = KIND_ORDER[a.kind] - KIND_ORDER[b.kind]
	if (byKind !== 0) return byKind
	return a.name.localeCompare(b.name)
}

/**
 * Build the sheet's render list, interleaving section bands between rows.
 *
 * Placement, in order of precedence:
 *
 *  1. Fewer than two rows produces no bands at all — there is no "between".
 *  2. Only markers falling strictly AFTER the first row's start and at or
 *     before the last row's start are eligible, so a band never opens the list.
 *  3. A SCENARIO pins immediately above its own launch banner when that banner
 *     is on the sheet, whatever else shares that start instant. This is what
 *     puts the band before its corresponding banner rather than before some
 *     other banner opening the same day.
 *  4. Everything else places by date — before the first row starting on or
 *     after it. Campaigns the user planned no banner for still get a band;
 *     that context is the point of the feature.
 *  5. Markers landing at the same point collapse into ONE band row carrying
 *     several lines, scenarios first.
 */
export function buildPlannerRows(
	banners: UserPlannedBanner[],
	scenarios: Scenario[],
	anniversaryEvents: AnniversaryEvent[]
): PlannerRow[] {
	const rows: PlannerRow[] = banners.map((banner, index) => ({
		kind: "banner" as const,
		banner,
		index,
	}))
	if (banners.length < 2) return rows

	// Resolved start per row, positionally aligned with `banners`. A row whose
	// banner has no resolvable timeline stays in the list but never anchors a
	// band — it has no date to compare against.
	const rowStarts = banners.map((banner) =>
		startTime(plannedBannerTimeline(banner)?.start_date)
	)
	const dated = rowStarts.filter((ms): ms is number => ms !== null)
	if (dated.length === 0) return rows

	const firstStart = Math.min(...dated)
	const lastStart = Math.max(...dated)

	const timelineIds = banners.map(
		(banner) => plannedBannerTimeline(banner)?.id ?? null
	)

	const markers: PlannerMarker[] = []
	for (const scenario of scenarios) {
		const ms = startTime(scenario.start_date)
		if (ms === null || ms <= firstStart || ms > lastStart) continue
		markers.push({
			key: `scenario-${scenario.id}`,
			kind: "scenario",
			name: scenario.name,
			startDate: scenario.start_date as string,
			bannerTimelineId: scenario.banner_timeline,
		})
	}
	for (const event of anniversaryEvents) {
		if (!bandsAsCampaign(event)) continue
		// The event's own start, not the campaign's opening: an anniversary
		// spends its Part 1 announcing itself with login rewards, and the band
		// marks where the anniversary actually lands. The fallback covers the
		// campaign kinds with no separate main part, where the backend resolves
		// the two to the same instant anyway.
		const startDate = event.main_start_date ?? event.start_date
		const ms = startTime(startDate)
		if (ms === null || ms <= firstStart || ms > lastStart) continue
		markers.push({
			key: `anniversary-${event.id}`,
			kind: "anniversary",
			name: event.name,
			startDate: startDate as string,
			bannerTimelineId: null,
		})
	}
	if (markers.length === 0) return rows

	markers.sort(compareMarkers)

	// Which row index each marker sits above. Pinned scenarios resolve to their
	// own banner's row; everything else to the first row starting on or after
	// it. Anything that resolves to nowhere is dropped rather than appended,
	// since a band below the last row isn't "between" anything.
	const placements = new Map<number, PlannerMarker[]>()
	for (const marker of markers) {
		let target = -1

		if (marker.bannerTimelineId !== null) {
			target = timelineIds.indexOf(marker.bannerTimelineId)
		}
		if (target === -1) {
			const ms = startTime(marker.startDate) as number
			target = rowStarts.findIndex((start) => start !== null && start >= ms)
		}
		if (target === -1) continue

		const existing = placements.get(target)
		if (existing) existing.push(marker)
		else placements.set(target, [marker])
	}
	if (placements.size === 0) return rows

	const out: PlannerRow[] = []
	rows.forEach((row, position) => {
		const banded = placements.get(position)
		if (banded) {
			out.push({
				kind: "band",
				// Keyed on the markers themselves, not the position: a band must
				// keep its identity when a row is added above it, or React
				// reuses one band's DOM for a different event.
				key: banded.map((marker) => marker.key).join("+"),
				markers: banded,
			})
		}
		out.push(row)
	})
	return out
}
