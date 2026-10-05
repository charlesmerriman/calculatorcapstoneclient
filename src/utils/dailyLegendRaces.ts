/**
 * The pure half of the Legend Races page: which batches show, how they split
 * around today, and how a batch's umas group by star count. The grind
 * guidance is admin-written page text, not maths.
 *
 * No React here, so every rule is tested on its own (see
 * __tests__/dailyLegendRaces.test.ts) and the page is mostly wiring.
 *
 * Nothing here feeds the carat projection. Pieces buy nothing it counts.
 */

import { differenceInCalendarDays } from "date-fns"
import type { DailyLegendRaceRelease, DailyLegendRaceUma } from "../types/dailyLegendRace"

/** A release that has a date, which is the only kind the site shows. */
export type DatedRelease = DailyLegendRaceRelease & { start_date: string }

/**
 * Drop the undated releases and sort the rest by date, soonest first.
 *
 * Undated is normal: an editor can enter a batch before the timeline has a
 * banner to link it to, and it stays off the site until they do. The API
 * already sorts, but the page sorts again so it never depends on that.
 */
export function datedReleases(releases: DailyLegendRaceRelease[]): DatedRelease[] {
	return releases
		.filter((release): release is DatedRelease => release.start_date !== null)
		.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
}

/**
 * Split dated releases around `now`. A release is out once its instant has
 * passed, the same rule the Timeline uses for a scenario (no end date, so the
 * start is all there is to judge it on).
 *
 * `upcoming` stays soonest first. `available` is NEWEST first, because the
 * batch a player most likely missed is the latest one.
 */
export function splitByToday(
	releases: DatedRelease[],
	now: Date
): { upcoming: DatedRelease[]; available: DatedRelease[] } {
	const upcoming: DatedRelease[] = []
	const available: DatedRelease[] = []
	for (const release of releases) {
		if (new Date(release.start_date).getTime() > now.getTime()) upcoming.push(release)
		else available.push(release)
	}
	return { upcoming, available: available.reverse() }
}

export interface RarityGroup {
	rarity: 1 | 2 | 3
	umas: DailyLegendRaceUma[]
}

/**
 * A batch's umas grouped ★3, ★2, ★1, keeping only the groups that have
 * someone in them. Order within a group is the API's (by name).
 */
export function rarityGroups(umas: DailyLegendRaceUma[]): RarityGroup[] {
	return ([3, 2, 1] as const)
		.map((rarity) => ({ rarity, umas: umas.filter((uma) => uma.rarity === rarity) }))
		.filter((group) => group.umas.length > 0)
}

/**
 * "today", "tomorrow" or "in 12 days", for a release that has not arrived.
 *
 * Calendar days in the viewer's own time, like the Timeline's countdown
 * badge (getCountdownLabel), so the count agrees with the date printed
 * beside it, which formatDate also renders locally.
 */
export function arrivalCountdown(start: Date, now: Date): string {
	const days = differenceInCalendarDays(start, now)
	if (days <= 0) return "today"
	if (days === 1) return "tomorrow"
	return `in ${days} days`
}

/**
 * Dated releases by the banner they arrive with, for the Timeline, which
 * shows each one as a note on that banner's card. A release with no banner
 * is undated anyway, so `datedReleases` has already dropped it.
 */
export function legendRacesByBanner(releases: DailyLegendRaceRelease[]): Map<number, DatedRelease[]> {
	const byBanner = new Map<number, DatedRelease[]>()
	for (const release of datedReleases(releases)) {
		if (release.banner_timeline == null) continue
		byBanner.set(release.banner_timeline, [...(byBanner.get(release.banner_timeline) ?? []), release])
	}
	return byBanner
}

/** Which dated release each uma joins, by uma id. For the oshi strip. */
export function releaseByUmaId(releases: DatedRelease[]): Map<number, DatedRelease> {
	const byUma = new Map<number, DatedRelease>()
	for (const release of releases) {
		for (const uma of release.umas) byUma.set(uma.id, release)
	}
	return byUma
}

/** The Legend Races route. */
export const LEGEND_RACES_PATH = "/app/legend-races"

/**
 * The query parameter naming one release card, for the Timeline note's
 * link. A parameter and not a `#hash` for the reason given in
 * utils/selectorsFocus.ts: the browser acts on a hash only for a document it
 * is loading, and this is a client-side route change. One kind of target, so
 * no kind prefix (the same call selectorsFocus makes).
 */
export const LEGEND_RACES_RELEASE_PARAM = "release"

/** The `to` for a react-router `<Link>` to one release's card. */
export function legendRacesReleaseHref(releaseId: number): string {
	return `${LEGEND_RACES_PATH}?${LEGEND_RACES_RELEASE_PARAM}=${releaseId}`
}

/**
 * Parse a `release` parameter, or null for anything unrecognised. Same rules
 * as parseCampaignFocus: off the URL, so a malformed value degrades to "no
 * target", and `Number("")` is 0, which the positivity check turns away.
 */
export function parseReleaseFocus(raw: string | null | undefined): number | null {
	if (!raw) return null
	const id = Number(raw)
	return Number.isInteger(id) && id > 0 ? id : null
}
