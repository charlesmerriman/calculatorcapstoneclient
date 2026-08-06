import { Gift, Ticket, Package } from "lucide-react"
import PredictedBadge from "../PredictedBadge"
import { formatDate } from "../../utils/dateFormat"
import { formatUsd } from "../../utils/formatCurrency"
import { SelectorTargetPicker } from "./SelectorTargetPicker"
import type { PlannedCampaign, PlannedProduct } from "../../hooks/useSelectorPlanner"
import type { BannerTimelineForViewing } from "../../types"

/** Per-type chrome, keyed off the backend's event_type tag. */
const EVENT_TYPE_STYLES: Record<string, { label: string; className: string }> = {
	anniversary: {
		label: "Anniversary",
		className: "border-brand/50 bg-brand/10 text-brand",
	},
	new_year: {
		label: "New Year",
		className: "border-amber-500/50 bg-amber-500/10 text-amber-300",
	},
	campaign: {
		label: "Campaign",
		className: "border-sky-500/50 bg-sky-500/10 text-sky-300",
	},
}

interface CampaignCardProps {
	campaign: PlannedCampaign
	timelineData: BannerTimelineForViewing[]
	onQuantityChange: (line: PlannedProduct, quantity: number) => void
	onTargetChange: (
		line: PlannedProduct,
		target: { uma: number | null; support: number | null }
	) => void
}

export const CampaignCard = ({
	campaign,
	timelineData,
	onQuantityChange,
	onTargetChange,
}: CampaignCardProps) => {
	const { event, lines, hasPassed, isUndated } = campaign
	// A passed campaign is read-only: its carats are already in the user's
	// balance, so planning it would double-count. Undated campaigns can't be
	// projected at all, so they're locked too rather than silently ignored.
	const locked = hasPassed || isUndated
	const typeStyle = EVENT_TYPE_STYLES[event.event_type] ?? EVENT_TYPE_STYLES.campaign

	const packs = lines.filter((line) => line.product.product_type === "carat_pack")
	const selectors = lines.filter(
		(line) => line.product.product_type !== "carat_pack"
	)

	return (
		<section
			className={`overflow-hidden rounded-xl border border-gray-700 bg-gray-800 ${
				locked ? "opacity-60" : ""
			}`}
		>
			<header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-gray-700 bg-gray-800/60 px-4 py-3">
				<h3 className="text-base font-semibold text-gray-100">{event.name}</h3>
				<span
					className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${typeStyle.className}`}
				>
					{typeStyle.label}
				</span>
				{event.is_predicted && <PredictedBadge />}
				{hasPassed && (
					<span className="rounded-full border border-gray-600 bg-gray-700 px-2 py-0.5 text-xs font-semibold text-gray-400">
						Passed
					</span>
				)}
				<span className="ml-auto text-sm text-gray-400">
					{isUndated
						? "Dates unknown"
						: `${formatDate(event.start_date)} – ${formatDate(event.end_date)}`}
				</span>
			</header>

			<div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
				{packs.length > 0 && (
					<div className="min-w-0">
						<h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-brand">
							<Package className="h-4 w-4 shrink-0" />
							Discounted carat packs
						</h4>
						<ul className="flex flex-col gap-2">
							{packs.map((line) => (
								<li
									key={line.product.id}
									className="flex items-center gap-2 rounded-lg bg-gray-700/50 px-3 py-2"
								>
									<span className="min-w-0 flex-1 truncate text-sm text-gray-200">
										{line.product.name}
									</span>
									<span className="shrink-0 text-xs text-gray-400">
										{formatUsd(line.product.usd_cost)}
									</span>
									<input
										type="number"
										min={0}
										max={line.product.max_quantity}
										value={line.quantity}
										disabled={locked}
										aria-label={`Quantity of ${line.product.name}`}
										className="w-16 shrink-0 rounded border border-gray-600 bg-gray-900 px-2 py-1 text-right text-sm text-gray-100 disabled:cursor-not-allowed"
										onChange={(e) =>
											onQuantityChange(line, Number(e.target.value))
										}
									/>
								</li>
							))}
						</ul>
					</div>
				)}

				{selectors.length > 0 && (
					<div className="min-w-0">
						<h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-brand">
							<Ticket className="h-4 w-4 shrink-0" />
							Selectors
						</h4>
						<ul className="flex flex-col gap-2">
							{selectors.map((line) => (
								<li
									key={line.product.id}
									className="rounded-lg bg-gray-700/50 px-3 py-2"
								>
									<div className="flex items-center gap-2">
										<input
											type="checkbox"
											checked={line.quantity > 0}
											disabled={locked}
											aria-label={`Claim ${line.product.name}`}
											className="h-4 w-4 shrink-0 accent-[var(--color-brand)]"
											onChange={(e) =>
												onQuantityChange(line, e.target.checked ? 1 : 0)
											}
										/>
										<span className="min-w-0 flex-1 truncate text-sm text-gray-200">
											{line.product.name}
										</span>
										<span className="shrink-0 text-xs text-gray-400">
											{line.product.usd_cost > 0
												? formatUsd(line.product.usd_cost)
												: "Free"}
										</span>
									</div>
									{line.quantity > 0 && (
										<div className="mt-2">
											<SelectorTargetPicker
												product={line.product}
												timelineData={timelineData}
												targetUma={line.purchase?.target_uma ?? null}
												targetSupport={line.purchase?.target_support ?? null}
												disabled={locked}
												onChange={(target) => onTargetChange(line, target)}
											/>
											{line.product.jp_cutoff_date && (
												<p className="mt-1 text-xs text-gray-500">
													Can only select cards released on JP by{" "}
													{formatDate(line.product.jp_cutoff_date)}.
												</p>
											)}
										</div>
									)}
								</li>
							))}
						</ul>
					</div>
				)}

				{lines.length === 0 && (
					<p className="text-sm text-gray-500">
						No packs or selectors recorded for this campaign yet.
					</p>
				)}
			</div>

			<footer className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-gray-700 bg-gray-900/40 px-4 py-2 text-sm">
				<span className="flex items-center gap-1.5 text-gray-400">
					<Gift className="h-4 w-4 shrink-0 text-brand" />
					This campaign
				</span>
				<span className="text-gray-200">
					{campaign.paidCarats.toLocaleString()} paid carats
				</span>
				<span className="text-gray-200">{formatUsd(campaign.usd)}</span>
				<span className="ml-auto text-xs text-gray-500">
					Cumulative: {campaign.cumulativePaidCarats.toLocaleString()} carats ·{" "}
					{formatUsd(campaign.cumulativeUsd)}
				</span>
			</footer>
		</section>
	)
}
