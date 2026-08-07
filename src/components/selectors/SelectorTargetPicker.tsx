import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { Search, X } from "lucide-react"
import { isCardEligible } from "../../utils/selectorTickets"
import type {
	AnniversaryEventProduct,
	BannerUma,
	BannerSupport,
	Uma,
	SupportCard
} from "../../types"

interface TargetOption {
	value: number
	label: string
	image: string
}

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

	const options = useMemo<TargetOption[]>(() => {
		// A spreadsheet's "(All)" row is a non-gacha catch-all, not a banner the
		// calculator presents to users. It has card links solely for source-data
		// bookkeeping, so it must not make those cards selector targets.
		const isGachaBanner = (name: string) => !/^\(all\)(?:\s+\d+)?$/i.test(name.trim())
		const seen = new Map<number, { label: string; image: string }>()
		const addEligibleCards = (cards: (Uma | SupportCard)[]) => {
			for (const card of cards) {
				if (seen.has(card.id)) continue
				if (!isCardEligible(card.first_jp_date, product.jp_cutoff_date)) continue
				seen.set(card.id, { label: card.name, image: card.image })
			}
		}

		if (isUma) {
			for (const banner of umaBannerData) {
				if (!isGachaBanner(banner.banner_timeline.name)) continue
				addEligibleCards(banner.umas)
			}
		} else {
			for (const banner of supportBannerData) {
				if (!isGachaBanner(banner.banner_timeline.name)) continue
				addEligibleCards(banner.support_cards)
			}
		}
		return [...seen.entries()]
			.map(([value, card]) => ({ value, ...card }))
			.sort((a, b) => a.label.localeCompare(b.label))
	}, [umaBannerData, supportBannerData, isUma, product.jp_cutoff_date])

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

	const choose = (option: TargetOption) => {
		onChange({
			uma: isUma ? option.value : null,
			support: isUma ? null : option.value,
		})
		setIsOpen(false)
	}

	const clear = () =>
		onChange({ uma: null, support: null })

	const cardSizeClass = isUma ? "h-28 w-28" : "h-28 w-[5.25rem]"

	return (
		<div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,30rem)_minmax(10rem,1fr)]">
			<div className="min-w-0">
				<div className="flex min-w-0 gap-1">
					<button
						type="button"
						disabled={disabled || options.length === 0}
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
			</div>
			<div className="flex min-h-32 items-center justify-center rounded-md border border-gray-700 bg-gray-900/35">
				{selected && (
					<img
						src={selected.image}
						alt={selected.label}
						loading="lazy"
						decoding="async"
						className={`rounded-md border border-gray-600 bg-gray-700 object-contain shadow-sm ${
							isUma ? "h-32 w-32" : "h-32 w-24"
						}`}
					/>
				)}
			</div>

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
