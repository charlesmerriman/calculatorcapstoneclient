import type { RefObject } from "react"
import { Link } from "react-router-dom"
import PredictedBadge from "../PredictedBadge"
import { FOCUS_SCROLL_MARGIN } from "../../hooks/useFocusScroll"
import { formatDate } from "../../utils/dateFormat"
import { timelineFocusHref } from "../../utils/timelineFocus"
import { arrivalCountdown, rarityGroups } from "../../utils/dailyLegendRaces"
import type { DatedRelease } from "../../utils/dailyLegendRaces"
import type { DailyLegendRaceUma } from "../../types"

const STARS: Record<1 | 2 | 3, string> = { 1: "★", 2: "★★", 3: "★★★" }

/**
 * One uma: her card art with her name under it, clamped to two lines so a
 * long outfit name cannot stretch its row. The name is visible because the
 * point of the page is "is MY uma in this batch".
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
 * One batch of umas joining the daily legend races: the name, date and badges
 * on one line, then the umas grouped ★3 / ★2 / ★1. The grind guidance is the
 * page's intro text, said once, not on every card.
 */
export const LegendRaceReleaseCard = ({
	release,
	now,
	isAvailable,
	oshiIds,
	focusRef,
	isFocused = false,
}: {
	release: DatedRelease
	now: Date
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
				<span className="text-sm text-gray-400">{formatDate(release.start_date)}</span>
				{release.is_predicted && <PredictedBadge />}
				{!isAvailable && (
					<span className="rounded-full border border-legend-race/50 bg-legend-race/15 px-2.5 py-0.5 text-xs font-semibold text-legend-race">
						{arrivalCountdown(start, now)}
					</span>
				)}
				{release.banner_timeline != null && (
					<Link
						to={timelineFocusHref({ kind: "banner", id: release.banner_timeline })}
						className="ml-auto text-sm text-brand transition hover:text-brand/75"
					>
						On the Timeline
					</Link>
				)}
			</div>

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
		</section>
	)
}
