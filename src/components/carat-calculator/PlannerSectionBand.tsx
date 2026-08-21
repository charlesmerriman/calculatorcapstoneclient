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
	{ text: string; icon: typeof Sparkles; iconSize: string; textColor: string; iconShell: string }
> = {
	scenario: {
		text: "text-sm font-semibold tracking-wide sm:text-base",
		icon: Gamepad2,
		iconSize: "h-4 w-4 sm:h-5 sm:w-5",
		textColor: "text-brand",
		iconShell: "text-brand",
	},
	anniversary: {
		text: "text-sm font-medium tracking-wide sm:text-base",
		icon: Sparkles,
		iconSize: "h-3.5 w-3.5 sm:h-4 sm:w-4",
		textColor: "text-gray-200",
		iconShell: "text-brand/85",
	},
}

/** Alternation follows visual order, never marker kind. */
const STRIP_TONES = [
	"bg-gray-900/45",
	"bg-brand/[0.07]",
]

export const PlannerSectionBand = ({ markers }: { markers: PlannerMarker[] }) => (
	/*
	 * role="presentation" so the band doesn't read as a data row to a screen
	 * reader: it's a landmark between rows, and its text is already announced.
	 * The outer surface uses the semantic gray ramp and the scenario treatment
	 * uses --color-brand, so every theme supplies its own contrast and accent.
	 * Strip fills alternate by visual order, while the scenario/anniversary icon
	 * and weight still communicate what kind of landmark it is. The surrounding
	 * rules make the otherwise empty row width read as a deliberate ledger
	 * divider rather than a large button.
	 */
	<div
		role="presentation"
		className="flex w-full flex-col border-y border-brand/20 bg-gray-900/20"
	>
		{markers.map((marker, index) => {
			const style = MARKER_STYLES[marker.kind]
			const Icon = style.icon
			const tone = STRIP_TONES[index % STRIP_TONES.length]
			return (
				<div
					key={marker.key}
					className={`flex min-h-9 w-full items-center justify-center px-4 py-1.5 ${index > 0 ? "border-t border-gray-700/80" : ""} ${tone}`}
				>
					<div className={`flex shrink-0 items-center gap-2 text-center ${style.text} ${style.textColor}`}>
						<Icon className={`${style.iconSize} ${style.iconShell}`} aria-hidden="true" />
						<span>{marker.name}</span>
					</div>
				</div>
			)
		})}
	</div>
)
