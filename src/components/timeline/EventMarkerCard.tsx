import { Sparkles } from "lucide-react"
import PredictedBadge from "../PredictedBadge"
import { BannerArtPlaceholder } from "./BannerArtPlaceholder"
import { formatDate } from "../../utils/dateFormat"
import { TIMELINE_FOCUS_HIGHLIGHT } from "./timelineShared"
import { FOCUS_SCROLL_MARGIN } from "../../hooks/useFocusScroll"
import type { TimelineFocusProps, TimelineMarker } from "./timelineShared"

/**
 * The timeline card for a scenario launch or a campaign opening.
 *
 * One component for both kinds, the way RaceEventCard serves Champions Meeting
 * and League of Heroes without ever branching on which it holds. The single
 * branch here is on whether the marker HAS an end date, not on its kind: a
 * scenario has none (it stays playable after release, so there is nothing to
 * close), while a campaign states its window.
 *
 * A missing image is the expected state, not a degraded one — scenarios get
 * entered while a feature is being built and the art lands later. The
 * placeholder is a designed fallback, the same call the step-up rows already
 * made in the planner.
 */

/**
 * `icon` is optional: a scenario chip carries no icon, so its label and the
 * brand accent alone distinguish it from a campaign.
 */
const MARKER_CHROME: Record<
	TimelineMarker["kind"],
	{ icon?: typeof Sparkles; label: string; accent: string }
> = {
	scenario: {
		label: "New scenario",
		accent: "border-brand/50 bg-brand/15 text-brand",
	},
	anniversary: {
		icon: Sparkles,
		label: "Campaign",
		accent: "border-gray-600 bg-gray-700/70 text-gray-200",
	},
}

export const EventMarkerCard = ({
	marker,
	focusRef,
	isFocused = false,
}: { marker: TimelineMarker } & TimelineFocusProps) => {
	const chrome = MARKER_CHROME[marker.kind]
	const Icon = chrome.icon
	// A scenario announces a change in how the game is played, so it gets the
	// louder heading; a campaign is a recurring sale and sits quieter.
	const isScenario = marker.kind === "scenario"

	return (
		// The root IS the panel here (a marker card has no strip above it), so the
		// scroll target and the arrival ring land on the same node.
		<div
			ref={focusRef}
			className={`card-panel w-full overflow-hidden rounded-xl p-3 sm:p-4 ${
				FOCUS_SCROLL_MARGIN
			} ${isScenario ? "border-brand/40" : ""} ${
				isFocused ? TIMELINE_FOCUS_HIGHLIGHT : ""
			}`}
		>
			<div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
				<span
					className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${chrome.accent}`}
				>
					{Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
					{chrome.label}
				</span>
				<h3
					className={`min-w-0 font-bold text-gray-100 ${
						isScenario ? "text-xl sm:text-2xl" : "text-lg"
					}`}
				>
					{marker.name}
				</h3>
				{marker.isPredicted && <PredictedBadge />}
			</div>

			<p className="mb-3 text-sm text-gray-300">
				{marker.endDate
					? `${formatDate(marker.startDate)} through ${formatDate(marker.endDate)}`
					// No end, and none is coming — see TimelineMarker.endDate.
					: `Releases ${formatDate(marker.startDate)}`}
			</p>

			{/*
			 * Capped on WIDTH and never on height: the art is 16:9, and a height
			 * clamp on a definite percentage width squashes the picture rather
			 * than fitting it. Same rule as the banner art.
			 *
			 * The 16:9 is also DECLARED, so the box exists before the image
			 * loads and nothing below it moves when it does — see BANNER_ART in
			 * BannerWindowCard for why that matters to the planner's deep links.
			 *
			 * Centred, because a marker card has no featured-card panels — the art
			 * is the only thing in the row, so there is no column edge to align its
			 * left side to. Same call as BANNER_ART_ALONE in BannerWindowCard.
			 */}
			<div className="mx-auto max-w-[41rem]">
				{marker.image ? (
					<img
						src={marker.image}
						alt={marker.name}
						loading="lazy"
						decoding="async"
						className="aspect-[16/9] h-auto w-full object-contain rounded-xl border border-gray-600 shadow-md"
					/>
				) : (
					<BannerArtPlaceholder />
				)}
			</div>
		</div>
	)
}
