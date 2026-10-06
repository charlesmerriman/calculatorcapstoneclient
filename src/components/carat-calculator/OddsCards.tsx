import { ChevronDown } from "lucide-react"
import type { RateUpCard } from "../../utils/rateUpRates"
import { formatRate } from "../../utils/oddsDisplay"

/**
 * The two pieces of the "which card are these odds for" control, shown only on
 * a banner with more than one rate-up card:
 *
 *   - OddsCaption: the line at the top of the odds strip. It names the card the
 *     strip is about, and doubles as the button that opens the panel, so the
 *     control costs no space of its own in the fixed-height table row.
 *   - OddsCardsPanel: the strip under the row (a band of the card on phones)
 *     where the player picks that card, and ticks a second one for two-card
 *     odds. Laid out like the note editor, for the same reason: the table row
 *     keeps its height and its columns.
 *
 * Both are plain view code. The choices they report are saved on the planned
 * row (`primary_card` / `second_card`), resolved by `oddsCards()` in
 * utils/rateUpRates, and turned into numbers by the row.
 */

interface OddsCaptionProps {
	primary: RateUpCard
	second: RateUpCard | null
	/** The strip's top cell, "MLB" or "5x", so the caption matches it. */
	topLabel: string
	open: boolean
	onToggle: () => void
}

export const OddsCaption = ({
	primary,
	second,
	topLabel,
	open,
	onToggle,
}: OddsCaptionProps) => {
	const text = second
		? `${primary.name} ${topLabel} + ${second.name}`
		: `Odds for ${primary.name}`
	const title = second
		? `Each box is the chance of ending with ${primary.name} at ${topLabel} and ${second.name} at that level. Together they add up to ${primary.name}'s ${topLabel} chance.`
		: "Pick which card these odds are for, or add a second card"

	return (
		<button
			type="button"
			onClick={onToggle}
			aria-expanded={open}
			title={title}
			// leading-3 keeps the line at 12px: the strip, this caption and the
			// table cell's padding have to fit the row's fixed 64px.
			className="flex w-full min-w-0 cursor-pointer items-center justify-center gap-1 px-1 text-[10px] leading-3 text-gray-300 transition hover:bg-gray-600 hover:text-gray-100"
		>
			<span className="truncate">{text}</span>
			<ChevronDown
				aria-hidden="true"
				className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
			/>
		</button>
	)
}

interface OddsCardsPanelProps {
	cards: RateUpCard[]
	primary: RateUpCard
	second: RateUpCard | null
	topLabel: string
	onPrimaryChange: (id: number) => void
	/** A card id to turn two-card odds on with, or null to turn them off. */
	onSecondChange: (id: number | null) => void
	className?: string
}

const selectClass =
	"min-w-0 max-w-full rounded-md border border-gray-600 bg-gray-900 px-2 py-1 text-xs text-gray-100 focus:border-gray-400 focus:outline-none disabled:opacity-50"

export const OddsCardsPanel = ({
	cards,
	primary,
	second,
	topLabel,
	onPrimaryChange,
	onSecondChange,
	className = "",
}: OddsCardsPanelProps) => {
	const others = cards.filter((card) => card.id !== primary.id)
	// What ticking the box turns on: the card already chosen, or the first
	// other one. The select shows it greyed out until then, so the player can
	// see what the box will add.
	const secondChoice = second ?? others[0]

	const option = (card: RateUpCard) => (
		<option key={card.id} value={card.id}>
			{card.name} ({formatRate(card.rate)})
		</option>
	)

	return (
		<div className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-300 ${className}`}>
			<label className="flex min-w-0 items-center gap-1.5">
				<span className="shrink-0">Odds for</span>
				<select
					value={primary.id}
					onChange={(event) => onPrimaryChange(Number(event.target.value))}
					className={selectClass}
				>
					{cards.map(option)}
				</select>
			</label>

			<div className="flex min-w-0 items-center gap-1.5">
				<label className="flex shrink-0 cursor-pointer items-center gap-1.5">
					<input
						type="checkbox"
						checked={second !== null}
						onChange={(event) =>
							onSecondChange(event.target.checked ? secondChoice.id : null)
						}
						className="h-4 w-4 shrink-0 accent-[var(--color-brand)]"
					/>
					<span>Also show</span>
				</label>
				<select
					value={secondChoice.id}
					disabled={second === null}
					aria-label="Second card"
					onChange={(event) => onSecondChange(Number(event.target.value))}
					className={selectClass}
				>
					{others.map(option)}
				</select>
			</div>

			{second && (
				<p className="w-full text-[11px] leading-snug text-gray-400">
					Each box is the chance of ending with {primary.name} at {topLabel} and{" "}
					{second.name} at that level. Every 200 pulls you can exchange for a copy,
					and those go to {primary.name} first.
				</p>
			)}
		</div>
	)
}
