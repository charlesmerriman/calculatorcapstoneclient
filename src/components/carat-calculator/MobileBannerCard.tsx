import type { ReactNode } from "react"
import { Trash2, X } from "lucide-react"

interface MobileBannerCardProps {
	bannerType: "Uma" | "Support"
	images: { name: string; image: string }[]
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

export const MobileBannerCard = ({
	bannerType,
	images,
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
	const typeClass = bannerType === "Uma" ? "bg-blue-900" : "bg-green-900"
	// The thumbnail tile clips whatever it contains, so it can only be rounded
	// where the art is too: uma icons have a rounded frame baked in, support card
	// art is a sharp-cornered rectangle and would get its own border sliced off.
	const thumbTileRadius = bannerType === "Uma" ? "rounded-md" : "rounded-none"

	return (
		<div className="@banner-table:hidden overflow-hidden rounded-lg border border-gray-600 bg-gray-800 shadow-sm">
			<div className={`flex min-h-[64px] items-stretch sm:min-h-[88px] ${typeClass}`}>
				<div className="flex w-16 shrink-0 flex-col items-center justify-center gap-0.5 bg-black/15 px-1 sm:w-28 sm:gap-1">
					<span className="text-xs font-bold tracking-wide text-white sm:text-sm">
						{bannerType === "Uma" ? "UMA" : "SUPPORT"}
					</span>
					{bannerType === "Uma" ? (
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5 text-white/90">
							<path d="M5 3v9a7 7 0 0 0 14 0V3" />
							<line x1="5" y1="3" x2="5" y2="6" />
							<line x1="19" y1="3" x2="19" y2="6" />
						</svg>
					) : (
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-white/90">
							<circle cx="9" cy="7" r="3" />
							<circle cx="15" cy="7" r="3" />
							<path d="M3 21v-1a6 6 0 0 1 9.5-4.9" />
							<path d="M12 21v-1a6 6 0 0 1 9-5.4" />
						</svg>
					)}
				</div>

				<div className="flex min-w-0 shrink-0 items-center gap-1 overflow-hidden px-1.5 py-2 sm:gap-2 sm:px-3">
					{images.length > 0 ? (
						images.slice(0, 2).map((img) => (
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
					) : null}
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
						<div className="mb-1 text-[10px] font-medium uppercase text-gray-500">Reserved</div>
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
