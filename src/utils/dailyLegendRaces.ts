/**
 * The pure half of the Legend Races page: which batches show, how they split
 * around today, how a batch's umas group by star count, and how long grinding
 * one uma takes.
 *
 * No React here, so every rule is tested on its own (see
 * __tests__/dailyLegendRaces.test.ts) and the page is mostly wiring.
 *
 * Nothing here feeds the carat projection. Pieces buy nothing it counts.
 */

import { differenceInCalendarDays } from "date-fns"
import { addUtcDays } from "./utcDates"
import { formatDate } from "./dateFormat"
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

export interface GrindInput {
	/** When the uma's daily race arrives (an API instant). */
	start: Date
	/** The current instant. A batch that is already out starts from here instead. */
	now: Date
	/** Pieces the player already holds for this uma. */
	held: number
	/** `daily_legend_race_piece_goal` */
	goal: number
	/** `daily_legend_race_pieces_per_day`, at least 1 */
	perDay: number
}

export interface GrindResult {
	/** Days of racing needed. 0 when `held` already reaches the goal. */
	days: number
	/**
	 * The day of the LAST race, or null when no racing is needed.
	 *
	 * Day 1 is the first race, so the finish is `days - 1` days after the
	 * start: 70 races starting Apr 14 end on Jun 22, not Jun 23. Same time of
	 * day as the start, so it formats onto the matching calendar day.
	 */
	finish: Date | null
}

/**
 * How long one uma takes to reach the goal, racing once a day.
 *
 * Every uma has her own daily race, so umas grind side by side and each
 * finish date is independent; there is no queue to model.
 */
export function grindFinish({ start, now, held, goal, perDay }: GrindInput): GrindResult {
	const remaining = Math.max(goal - held, 0)
	// Guarded even though the admin refuses 0: a division by zero here would
	// put "Infinity days" on the page.
	const days = Math.ceil(remaining / Math.max(perDay, 1))
	if (days === 0) return { days, finish: null }
	const from = start.getTime() > now.getTime() ? start : now
	return { days, finish: addUtcDays(from, days - 1) }
}

/** The three admin numbers the grind line is built from. */
export interface GrindNumbers {
	goal: number
	eventPieces: number
	perDay: number
}

/**
 * "150 pieces by 2027/2/26 with the event's 80, or 2027/5/17 from zero."
 *
 * Every number comes from the API (the three grind constants), so an admin
 * edit changes the sentence without a deploy. `start` is when racing can
 * begin: the batch's date, or now for a batch already out.
 */
export function grindSummary(start: Date, now: Date, { goal, eventPieces, perDay }: GrindNumbers): string {
	const withEvent = grindFinish({ start, now, held: eventPieces, goal, perDay })
	const fromZero = grindFinish({ start, now, held: 0, goal, perDay })
	const by = (finish: Date | null) => (finish ? formatDate(finish.toISOString()) : "")
	// An event that already gave the whole goal leaves nothing to grind with it.
	if (withEvent.finish === null) return `${goal} pieces by ${by(fromZero.finish)} from zero.`
	return `${goal} pieces by ${by(withEvent.finish)} with the event's ${eventPieces}, or ${by(fromZero.finish)} from zero.`
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
