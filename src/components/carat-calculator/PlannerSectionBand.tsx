import { Gamepad2, Sparkles } from "lucide-react"
import type { PlannerMarker } from "../../utils/plannerSections"

/**
 * A full-width section band between planner rows, marking a scenario launch or
 * an anniversary opening.
 *
 * Deliberately NOT `.banner-grid`: the band spans the row stack rather than
 * occupying columns, so it adds no track and leaves --container-banner-table
 * (and its hard ceiling) alone. Being a plain full-width block is also what
 * lets one component serve both display modes — the stack renders mobile cards
 * below the container width and table rows above it, and this reads correctly
 * either way.
 *
 * This is not AnniversaryEventStrip. That strip is left-aligned with squared
 * bottom corners because it welds onto the top of a timeline card; this is a
 * centred divider that belongs to neither neighbour.
 */

/** Per-kind chrome. Scenario reads louder — see the note in the component. */
const MARKER_STYLES: Record<
	PlannerMarker["kind"],
	{ text: string; icon: typeof Sparkles; iconSize: string }
> = {
	scenario: {
		text: "text-base sm:text-lg font-semibold tracking-wide",
		icon: Gamepad2,
		iconSize: "h-4 w-4 sm:h-5 sm:w-5",
	},
	anniversary: {
		text: "text-sm sm:text-base font-medium tracking-wide opacity-90",
		icon: Sparkles,
		iconSize: "h-3.5 w-3.5 sm:h-4 sm:w-4",
	},
}

export const PlannerSectionBand = ({ markers }: { markers: PlannerMarker[] }) => (
	/*
	 * role="presentation" so the band doesn't read as a data row to a screen
	 * reader: it's a landmark between rows, and its text is already announced.
	 * Colour comes from the --color-brand theme token (never a literal gold),
	 * because stock palette classes don't survive the light-theme flip.
	 */
	<div
		role="presentation"
		className="flex w-full flex-col items-center gap-0.5 border-y border-brand/25 bg-brand/10 px-3 py-2"
	>
		{markers.map((marker) => {
			const style = MARKER_STYLES[marker.kind]
			const Icon = style.icon
			return (
				<div
					key={marker.key}
					className={`flex items-center justify-center gap-2 text-center text-brand ${style.text}`}
				>
					{/*
					 * A scenario is the larger statement of the two — a new way to
					 * play the game, against a recurring sale — so it carries the
					 * heavier weight and the bigger glyph. Differentiated by size
					 * and icon rather than a second hue: only the headline signal
					 * gets a colour here, or the colour stops meaning anything.
					 */}
					<Icon className={`${style.iconSize} shrink-0`} aria-hidden="true" />
					<span>{marker.name}</span>
				</div>
			)
		})}
	</div>
)
