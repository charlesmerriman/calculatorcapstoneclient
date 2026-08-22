import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { Trash2, X } from "lucide-react"
import { BannerTypeIcon } from "./BannerTypeBadge"
import type { BannerRowType } from "../../utils/bannerHelpers"
import { ReservedColumnIcons, RESERVED_COLUMN_TITLE } from "./ReservedColumnIcons"
import { ExtraCardsBadge } from "./ExtraCardsBadge"

interface MobileBannerCardProps {
	bannerType: BannerRowType
	images: { name: string; image: string }[]
	/**
	 * Replaces the thumbnail strip entirely. A step-up row has no featured cards
	 * to thumbnail — the player picks their own from the back catalogue — so it
	 * supplies its own chip instead of an empty tile rail.
	 */
	imagesSlot?: ReactNode
	/**
	 * Where the thumbnail strip links to — this row's banner on the Timeline, or
	 * null on a row with no banner selected yet. Passed as a href rather than the
	 * caller wrapping `imagesSlot` itself, so the link wraps the strip on every
	 * row kind: the ordinary rows render their thumbnails HERE, from `images`,
	 * and never go through the slot.
	 */
	imagesHref?: string | null
	bannerSelect: ReactNode
	dates: ReactNode
	summary: ReactNode
	pullsInput: ReactNode
	reservedInput: ReactNode
	chanceDisplay: ReactNode
	onRemove: () => void
	removeLabel: string
	removeIcon?: "delete" | "discard"
}

/**
 * Per-kind presentation, in ONE place rather than three parallel ternaries down
 * the component. Three separate `=== "Uma" ? … : …` expressions all had to be
 * found and widened together whenever a kind was added, and a missed one failed
 * silently by rendering the other kind's treatment.
 *
 * `thumbTileRadius`: the tile clips whatever it contains, so it can only be
 * rounded where the art is too. Uma icons have a rounded frame baked in; support
 * card art is a sharp-cornered rectangle and would get its own border sliced off.
 */
const TYPE_STYLES: Record<
	BannerRowType,
	{ label: string; tile: string; thumbTileRadius: string }
> = {
	Uma: { label: "UMA", tile: "bg-blue-900", thumbTileRadius: "rounded-md" },
	Support: { label: "SUPPORT", tile: "bg-green-900", thumbTileRadius: "rounded-none" },
	// Provisional: a step-up carries no featured cards, so the thumb radius is
	// moot until its own artwork lands. Final treatment comes with the step-up
	// UI phase — see step-up-banners-plan.md.
	StepUp: { label: "STEP UP", tile: "bg-purple-900", thumbTileRadius: "rounded-md" },
}

/**
 * The card's thumbnail strip, wrapped in a link to the Timeline when there is a
 * banner to link to.
 *
 * Split out only so the link doesn't have to be threaded through the JSX twice
 * — the wrapper is the single branch, and what it contains is identical either
 * way. The `<Link>` carries the same flex box the strip's parent already
 * establishes, so wrapping changes no layout.
 */
const Thumbnails = ({
	href,
	slot,
	images,
	thumbTileRadius,
}: {
	href?: string | null
	slot?: ReactNode
	images: { name: string; image: string }[]
	thumbTileRadius: string
}) => {
	const strip = slot ?? (
		<>
			{images.length > 0
				? images.slice(0, 2).map((img) => (
						<div
							key={img.name}
							className={`flex h-12 min-w-0 shrink-0 items-center justify-center overflow-hidden ${thumbTileRadius} bg-black/10 ring-1 ring-white/10 sm:h-[80px]`}
						>
							<img
								src={img.image}
								alt={img.name}
								className="h-full w-auto object-contain"
							/>
						</div>
					))
				: null}
			<ExtraCardsBadge hidden={images.length - 2} />
		</>
	)

	if (!href) return strip

	return (
		<Link
			to={href}
			title="View this banner on the timeline"
			className="flex min-w-0 shrink-0 items-center gap-1 sm:gap-2"
		>
			{strip}
		</Link>
	)
}

export const MobileBannerCard = ({
	bannerType,
	images,
	imagesSlot,
	imagesHref,
	bannerSelect,
	dates,
	summary,
	pullsInput,
	reservedInput,
	chanceDisplay,
	onRemove,
	removeLabel,
	removeIcon = "delete",
}: MobileBannerCardProps) => {
	const Icon = removeIcon === "delete" ? Trash2 : X
	const style = TYPE_STYLES[bannerType]

	return (
		<div className="@banner-table:hidden overflow-hidden rounded-lg border border-gray-600 bg-gray-800 shadow-sm">
			<div className={`flex min-h-[64px] items-stretch sm:min-h-[88px] ${style.tile}`}>
				<div className="flex w-16 shrink-0 flex-col items-center justify-center gap-0.5 bg-black/15 px-1 sm:w-28 sm:gap-1">
					<span className="text-xs font-bold tracking-wide text-white sm:text-sm">
						{style.label}
					</span>
					<BannerTypeIcon type={bannerType} className="h-5 w-5 text-white/90" />
				</div>

				<div className="relative flex min-w-0 shrink-0 items-center gap-1 overflow-hidden px-1.5 py-2 sm:gap-2 sm:px-3">
					<Thumbnails
						href={imagesHref}
						slot={imagesSlot}
						images={images}
						thumbTileRadius={style.thumbTileRadius}
					/>
				</div>

				<div className="flex min-w-0 flex-1 items-center py-2 pr-1">
					{bannerSelect}
				</div>

				<button
					onClick={onRemove}
					aria-label={removeLabel}
					title={removeLabel}
					className="my-auto mr-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-red-400/40 bg-black/10 text-red-400 transition hover:bg-black/25 sm:mr-3 sm:h-12 sm:w-12"
				>
					<Icon className="h-5 w-5" />
				</button>
			</div>

			<div className="bg-gray-900/35">
				<div className="grid grid-cols-[minmax(0,1fr)_6rem_6rem] border-b border-gray-700 sm:grid-cols-[minmax(0,1fr)_6.25rem_6.25rem]">
					<div className="min-w-0 border-r border-gray-700 px-4 py-2.5">
						<div className="mb-1 text-[10px] font-medium uppercase text-gray-500">Dates</div>
						{dates}
					</div>
					<div className="flex min-w-0 flex-col items-center justify-center border-r border-gray-700 px-2 py-2.5">
						<div className="mb-1 text-[10px] font-medium uppercase text-gray-500">Pulls</div>
						{pullsInput}
					</div>
					<div className="flex min-w-0 flex-col items-center justify-center px-2 py-2.5">
						{/* Icons rather than the word, matching the desktop table header.
						    w-4 here, not the header's w-5: these sit in a row of 10px
						    caps labels ("Dates", "Pulls") and 20px would tower over them. */}
						<div
							className="mb-1 flex items-center justify-center gap-1"
							title={RESERVED_COLUMN_TITLE}
						>
							<ReservedColumnIcons size="w-4 h-4" />
						</div>
						{reservedInput}
					</div>
				</div>

				<div className="p-3">
					{summary}
					{chanceDisplay && <div className="mt-3">{chanceDisplay}</div>}
				</div>
			</div>
		</div>
	)
}
