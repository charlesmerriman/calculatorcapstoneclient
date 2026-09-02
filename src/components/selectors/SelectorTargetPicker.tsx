import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { ImagePlus, Search, X } from "lucide-react"
import { useEligibleCardCatalogue } from "../../hooks/useEligibleCardCatalogue"
import { formatDate } from "../../utils/dateFormat"
import type { EligibleCard } from "../../hooks/useEligibleCardCatalogue"
import type {
	AnniversaryEventProduct,
	BannerUma,
	BannerSupport
} from "../../types"

interface SelectorTargetPickerProps {
	product: AnniversaryEventProduct
	umaBannerData: BannerUma[]
	supportBannerData: BannerSupport[]
	targetUma: number | null
	targetSupport: number | null
	disabled: boolean
	onChange: (target: { uma: number | null; support: number | null }) => void
}

/**
 * An image-library picker for selector tickets. It deliberately mirrors the
 * admin's browse-and-search flow. Its catalogue is limited to cards on the
 * calculator's real gacha banners (past and upcoming), then filtered to this
 * ticket's JP cutoff.
 */
export const SelectorTargetPicker = ({
	product,
	umaBannerData,
	supportBannerData,
	targetUma,
	targetSupport,
	disabled,
	onChange,
}: SelectorTargetPickerProps) => {
	const [isOpen, setIsOpen] = useState(false)
	const [search, setSearch] = useState("")
	const isUma = product.product_type === "uma_selector"

	// The catalogue rules — "(All)" exclusion, inclusive cutoff, newest-first
	// ordering — live in the hook, shared with the step-up selection picker.
	const options = useEligibleCardCatalogue({
		pool: isUma ? "uma" : "support",
		jpCutoffDate: product.jp_cutoff_date,
		umaBannerData,
		supportBannerData,
	})

	const selectedId = isUma ? targetUma : targetSupport
	const selected = options.find((option) => option.value === selectedId) ?? null
	const matchingOptions = options.filter((option) =>
		option.label.toLocaleLowerCase().includes(search.toLocaleLowerCase())
	)

	useEffect(() => {
		if (!isOpen) return undefined

		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") setIsOpen(false)
		}
		window.addEventListener("keydown", closeOnEscape)
		return () => window.removeEventListener("keydown", closeOnEscape)
	}, [isOpen])

	const choose = (option: EligibleCard) => {
		onChange({
			uma: isUma ? option.value : null,
			support: isUma ? null : option.value,
		})
		setIsOpen(false)
	}

	const clear = () =>
		onChange({ uma: null, support: null })

	const canPick = !disabled && options.length > 0

	// Grid tile size inside the modal.
	const cardSizeClass = isUma ? "h-28 w-28" : "h-28 w-[5.25rem]"
	// The chosen card is the point of the row, so it gets the space: a fixed
	// HEIGHT (both pools are portrait-or-square, so height is the aspect-safe
	// dimension) with the frame hugging it, and the button stack taking
	// whatever is left. Sizing by height also keeps every thumbnail in the grid
	// on one line. What must NOT come back is the old 128px frame in its own
	// grid column, which set the row's height and left the button's column
	// empty for most of it.
	const thumbClass = isUma ? "h-32 w-32" : "h-32 w-24"

	return (
		<div className="flex min-w-0 items-start gap-3">
			<div className="min-w-0 flex-1">
				<div className="flex min-w-0 gap-1">
					<button
						type="button"
						disabled={!canPick}
						aria-haspopup="dialog"
						aria-expanded={isOpen}
						className="min-w-0 flex-1 rounded border border-gray-600 bg-gray-700 px-3 py-1.5 text-left text-xs text-gray-100 transition hover:border-gray-500 disabled:cursor-not-allowed disabled:text-gray-500"
						onClick={() => {
							setSearch("")
							setIsOpen(true)
						}}
					>
						<span className="block truncate">
							{selected?.label ?? (options.length === 0
								? "No eligible cards"
								: `Choose ${isUma ? "an uma" : "a support card"}`)}
						</span>
					</button>
					{selected && (
						<button
							type="button"
							disabled={disabled}
							aria-label={`Clear ${selected.label}`}
							className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-gray-600 bg-gray-700 text-gray-300 transition hover:border-gray-500 hover:text-gray-100 disabled:cursor-not-allowed"
							onClick={clear}
						>
							<X className="h-4 w-4" />
						</button>
					)}
				</div>
				{/* The cutoff belongs to the picker rather than the caller: it is
				    what decides which cards the catalogue above offers. */}
				{product.jp_cutoff_date && (
					<p className="mt-1 text-[0.7rem] text-gray-500">
						JP cutoff: {formatDate(product.jp_cutoff_date)}
					</p>
				)}
			</div>
			{/* Kept mounted while empty so choosing a card doesn't reflow the row
			    (and, in a grid of these, every sibling cell with it). At this size
			    an inert empty box would just be the dead space again, so the frame
			    opens the picker too — dashed while it is still a placeholder.
			    Mouse-only sugar: aria-hidden + tabIndex -1 keep it out of the
			    a11y tree, where the labelled button beside it already does this. */}
			<button
				type="button"
				aria-hidden="true"
				tabIndex={-1}
				disabled={!canPick}
				className={`flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-gray-900/35 transition ${thumbClass} ${
					selected ? "border-gray-700" : "border-dashed border-gray-600 text-gray-600"
				} ${canPick ? "hover:border-gray-500" : "cursor-not-allowed"}`}
				onClick={() => {
					setSearch("")
					setIsOpen(true)
				}}
			>
				{selected ? (
					<img
						src={selected.image}
						alt={selected.label}
						loading="lazy"
						decoding="async"
						className={`object-contain ${thumbClass}`}
					/>
				) : (
					<ImagePlus className="h-6 w-6" />
				)}
			</button>

			{isOpen && createPortal(
				<div
					className="fixed inset-0 z-[10000] flex items-center justify-center bg-gray-950/75 p-4"
					onMouseDown={(event) => {
						if (event.target === event.currentTarget) setIsOpen(false)
					}}
				>
					<section
						role="dialog"
						aria-modal="true"
						aria-label={`Choose ${isUma ? "an uma" : "a support card"}`}
						className="flex max-h-[min(44rem,calc(100vh-2rem))] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-gray-600 bg-gray-800 shadow-2xl"
					>
						<header className="flex flex-wrap items-center gap-3 border-b border-gray-700 bg-gray-800/80 px-4 py-3">
							<div className="min-w-0 flex-1">
								<h5 className="text-base font-semibold text-gray-100">
									Choose {isUma ? "an Uma" : "a support card"}
								</h5>
								<p className="text-xs text-gray-400">{options.length} eligible cards</p>
							</div>
							<label className="relative w-full sm:w-64">
								<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
								<input
									autoFocus
									type="search"
									value={search}
									onChange={(event) => setSearch(event.target.value)}
									placeholder="Search cards…"
									className="w-full rounded border border-gray-600 bg-gray-900 py-2 pl-9 pr-3 text-sm text-gray-100 outline-none placeholder:text-gray-500 focus:border-brand"
								/>
							</label>
							<button
								type="button"
								aria-label="Close card picker"
								className="flex h-9 w-9 items-center justify-center rounded border border-gray-600 text-gray-300 transition hover:bg-gray-700 hover:text-gray-100"
								onClick={() => setIsOpen(false)}
							>
								<X className="h-5 w-5" />
							</button>
						</header>

						<div className="min-h-0 overflow-y-auto p-4">
							{matchingOptions.length === 0 ? (
								<p className="py-12 text-center text-sm text-gray-400">
									No eligible cards match that search.
								</p>
							) : (
								<div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-3">
									{matchingOptions.map((option) => {
										const isSelected = option.value === selectedId
										return (
											<button
												key={option.value}
												type="button"
												aria-pressed={isSelected}
												className={`group flex min-w-0 flex-col items-center rounded-lg border p-2 text-center transition ${
													isSelected
														? "border-brand bg-brand/10"
														: "border-gray-600 bg-gray-700/50 hover:border-gray-500 hover:bg-gray-700"
												}`}
												onClick={() => choose(option)}
											>
												<img
													src={option.image}
													alt=""
													loading="lazy"
													decoding="async"
													className={`${cardSizeClass} object-contain`}
												/>
												<span className="mt-2 line-clamp-2 min-h-9 text-xs font-medium leading-tight text-gray-100">
													{option.label}
												</span>
											</button>
										)
									})}
								</div>
							)}
						</div>
					</section>
				</div>,
				document.body
			)}
		</div>
	)
}
