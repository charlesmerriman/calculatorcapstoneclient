import type { RefObject } from "react"
import { Link } from "react-router-dom"
import PredictedBadge from "../PredictedBadge"
import { FOCUS_SCROLL_MARGIN } from "../../hooks/useFocusScroll"
import { formatDate } from "../../utils/dateFormat"
import { timelineFocusHref } from "../../utils/timelineFocus"
import { arrivalCountdown, grindFinish, rarityGroups } from "../../utils/dailyLegendRaces"
import type { DatedRelease } from "../../utils/dailyLegendRaces"
import type { DailyLegendRaceUma } from "../../types"

/** The three admin numbers the grind line is built from. */
export interface GrindNumbers {
	goal: number
	eventPieces: number
	perDay: number
}

const STARS: Record<1 | 2 | 3, string> = { 1: "★", 2: "★★", 3: "★★★" }

/**
 * One uma: her card art with her name under it.
 *
 * The name is visible rather than left to alt text, because the point of the
 * page is "is MY uma in this batch", and card art alone makes a reader
 * recognise every outfit by sight. Clamped to two lines so a long outfit name
 * ("Sakura Bakushin O (Sports Festival)") cannot stretch its row.
 */
const UmaTile = ({ uma, isOshi }: { uma: DailyLegendRaceUma; isOshi: boolean }) => (
	<li className="flex min-w-0 flex-col items-center gap-1">
		<div
			className={`aspect-square w-full overflow-hidden rounded-lg bg-gray-900/40 ${
				isOshi ? "ring-2 ring-brand" : ""
			}`}
		>
			{uma.image && (
				<img
					src={uma.image}
					alt=""
					loading="lazy"
					decoding="async"
					className="block h-full w-full object-contain"
				/>
			)}
		</div>
		<span className="line-clamp-2 text-center text-xs leading-tight text-gray-300">
			{uma.name}
			{isOshi && <span className="sr-only"> (your oshi)</span>}
		</span>
	</li>
)

/**
 * The "how long" line under a batch.
 *
 * Every number comes from the API (the three grind constants), so an admin
 * edit changes the sentence without a deploy. A batch already out counts from
 * today, because that is the soonest a player can start.
 */
function grindLine(release: DatedRelease, now: Date, numbers: GrindNumbers, isAvailable: boolean): string {
	const start = new Date(release.start_date)
	const { goal, eventPieces, perDay } = numbers
	const withEvent = grindFinish({ start, now, held: eventPieces, goal, perDay })
	const fromZero = grindFinish({ start, now, held: 0, goal, perDay })
	const when = isAvailable ? "starting today" : "from the day they arrive"
	const done = (finish: Date | null) => (finish ? ` (done ${formatDate(finish.toISOString())})` : "")

	const fromZeroPart = `${fromZero.days} days from zero${done(fromZero.finish)}`
	// An event that already gave the whole goal leaves nothing to grind, so
	// that half of the sentence is dropped rather than reading "0 days".
	if (withEvent.days === 0) {
		return `To get one uma to ${goal} pieces ${when}: ${fromZeroPart}. The ${eventPieces} from their original event already covers it.`
	}
	return (
		`To get one uma to ${goal} pieces ${when}: ${withEvent.days} days if you have ` +
		`the ${eventPieces} from their original event${done(withEvent.finish)}, or ${fromZeroPart}.`
	)
}

/**
 * One batch of umas joining the daily legend races.
 *
 * The heading says when, the tiles say who (grouped ★3 / ★2 / ★1, only the
 * groups the batch has), and the last line says how long. "See it on the
 * Timeline" is one half of a two-way link: the Timeline's marker for this
 * batch links back here.
 */
export const LegendRaceReleaseCard = ({
	release,
	now,
	numbers,
	isAvailable,
	oshiIds,
	focusRef,
	isFocused = false,
}: {
	release: DatedRelease
	now: Date
	numbers: GrindNumbers
	isAvailable: boolean
	oshiIds: ReadonlySet<number>
	focusRef?: RefObject<HTMLElement | null>
	isFocused?: boolean
}) => {
	const start = new Date(release.start_date)
	const headingId = `legend-race-release-${release.id}`

	return (
		<section
			ref={focusRef}
			aria-labelledby={headingId}
			className={`card-panel p-3 sm:p-4 ${FOCUS_SCROLL_MARGIN} ${
				isFocused ? "ring-2 ring-brand ring-offset-2 ring-offset-gray-900" : ""
			}`}
		>
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
				<h3 id={headingId} className="text-lg font-bold text-gray-100">
					{release.name}
				</h3>
				{release.is_predicted && <PredictedBadge />}
				{!isAvailable && (
					<span className="rounded-full border border-legend-race/50 bg-legend-race/15 px-2.5 py-0.5 text-xs font-semibold text-legend-race">
						{arrivalCountdown(start, now)}
					</span>
				)}
			</div>
			<p className="mt-1 text-sm text-gray-300">
				{isAvailable ? "In the daily races since " : "Joins the daily races "}
				{formatDate(release.start_date)}
				<span aria-hidden="true"> · </span>
				<Link
					to={timelineFocusHref({ kind: "legend_race", id: release.id })}
					className="text-brand transition hover:text-brand/75"
				>
					See it on the Timeline
				</Link>
			</p>

			{release.umas.length > 0 && (
				<div className="mt-3 flex flex-col gap-3">
					{rarityGroups(release.umas).map((group) => (
						<div key={group.rarity}>
							<h4 className="mb-1.5 text-sm font-semibold text-brand">
								<span aria-hidden="true">{STARS[group.rarity]}</span>
								<span className="sr-only">{group.rarity} star</span>
							</h4>
							<ul className="grid grid-cols-[repeat(auto-fill,minmax(4.75rem,1fr))] gap-x-2 gap-y-3 sm:grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))]">
								{group.umas.map((uma) => (
									<UmaTile key={uma.id} uma={uma} isOshi={oshiIds.has(uma.id)} />
								))}
							</ul>
						</div>
					))}
				</div>
			)}

			<p className="mt-3 text-sm text-gray-400">{grindLine(release, now, numbers, isAvailable)}</p>
		</section>
	)
}
