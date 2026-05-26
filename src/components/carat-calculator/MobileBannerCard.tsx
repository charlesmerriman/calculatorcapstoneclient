import type { ReactNode } from "react"
import { Trash2, X } from "lucide-react"

interface MobileBannerCardProps {
	bannerType: "Uma" | "Support"
	images: { name: string; image: string }[]
	bannerSelect: ReactNode
	dates: ReactNode
	summary: ReactNode
	pullsInput: ReactNode
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
	chanceDisplay,
	onRemove,
	removeLabel,
	removeIcon = "delete",
}: MobileBannerCardProps) => {
	const Icon = removeIcon === "delete" ? Trash2 : X
	const typeClass = bannerType === "Uma" ? "bg-blue-900" : "bg-green-900"

	return (
		<div className="md:hidden overflow-hidden rounded-lg border border-gray-600 bg-gray-800 shadow-sm">
			<div className={`relative flex min-h-[88px] items-stretch ${typeClass}`}>
				<div className="flex w-[74px] shrink-0 items-center justify-center bg-black/15 px-2">
					<span className="text-xs font-bold text-white">
						{bannerType === "Uma" ? "UMA" : "SUPPORT"}
					</span>
				</div>

				<div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden px-2.5 py-2 pr-12">
					{images.length > 0 ? (
						images.slice(0, 2).map((img) => (
							<div
								key={img.name}
								className="flex h-[72px] min-w-0 shrink-0 items-center justify-center overflow-hidden rounded-md bg-black/10 ring-1 ring-white/10"
							>
								<img
									src={img.image}
									alt={img.name}
									className="h-full w-auto object-contain"
								/>
							</div>
						))
					) : (
						<div className="flex h-[72px] w-full items-center justify-center rounded-md border border-white/10 bg-black/10 text-xs font-medium text-white/55">
							Select banner
						</div>
					)}
				</div>

				<button
					onClick={onRemove}
					aria-label={removeLabel}
					title={removeLabel}
					className="absolute right-2 top-2 flex h-9 w-9 shrink-0 items-center justify-center rounded border border-white/15 bg-black/20 text-white transition hover:bg-black/30"
				>
					<Icon className="h-4 w-4" />
				</button>
			</div>

			<div className="space-y-3 p-3">
				{bannerSelect}

				<div className="grid grid-cols-[minmax(0,1fr)_6.25rem] overflow-hidden rounded border border-gray-700 bg-gray-900/60">
					<div className="min-w-0 border-r border-gray-700 p-2.5">
						<div className="mb-1 text-[10px] font-semibold uppercase text-gray-500">Dates</div>
						{dates}
					</div>
					<div className="flex min-w-0 flex-col items-center justify-start p-2.5">
						<div className="mb-1 text-[10px] font-semibold uppercase text-gray-500">Pulls</div>
						{pullsInput}
					</div>
				</div>

				{summary}
				{chanceDisplay}
			</div>
		</div>
	)
}
