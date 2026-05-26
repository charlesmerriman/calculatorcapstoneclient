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

	return (
		<div className="md:hidden overflow-hidden rounded-lg border border-gray-700 bg-gray-800 shadow-sm">
			<div
				className={`flex items-center justify-between gap-2 px-3 py-2 ${
					bannerType === "Uma" ? "bg-blue-900" : "bg-green-900"
				}`}
			>
				<div className="flex min-w-0 items-center gap-2">
					<span className="shrink-0 text-xs font-bold tracking-wide text-white">
						{bannerType === "Uma" ? "UMA" : "SUPPORT"}
					</span>
					<div className="flex min-w-0 items-center gap-1 overflow-hidden">
						{images.slice(0, 2).map((img) => (
							<img
								key={img.name}
								src={img.image}
								alt={img.name}
								className="h-10 w-auto shrink-0 rounded object-contain"
							/>
						))}
					</div>
				</div>
				<button
					onClick={onRemove}
					aria-label={removeLabel}
					title={removeLabel}
					className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-white/15 bg-black/15 text-white transition hover:bg-black/25"
				>
					<Icon className="h-4 w-4" />
				</button>
			</div>

			<div className="space-y-3 p-3">
				{bannerSelect}

				<div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
					<div className="rounded border border-gray-700 bg-gray-900/60 p-2">
						<div className="mb-1 text-[10px] font-semibold uppercase text-gray-500">Dates</div>
						{dates}
					</div>
					<div className="rounded border border-gray-700 bg-gray-900/60 p-2">
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
