import { Gift, Ticket, Package } from "lucide-react"
import PredictedBadge from "../PredictedBadge"
import { formatDate } from "../../utils/dateFormat"
import { formatUsd } from "../../utils/formatCurrency"
import { SelectorTargetPicker } from "./SelectorTargetPicker"
import type { PlannedCampaign, PlannedProduct } from "../../hooks/useSelectorPlanner"
import type { BannerUma, BannerSupport } from "../../types"

interface CampaignCardProps {
	campaign: PlannedCampaign
	umaBannerData: BannerUma[]
	supportBannerData: BannerSupport[]
	onQuantityChange: (line: PlannedProduct, quantity: number) => void
	onTargetChange: (
		line: PlannedProduct,
		target: { uma: number | null; support: number | null }
	) => void
}

export const CampaignCard = ({
	campaign,
	umaBannerData,
	supportBannerData,
	onQuantityChange,
	onTargetChange,
}: CampaignCardProps) => {
	const { event, lines, isUndated } = campaign
	// Passed campaigns are removed before this component receives them. Undated
	// campaigns stay visible but can't be projected, so they remain read-only.
	const locked = isUndated

	const packs = lines.filter((line) => line.product.product_type === "carat_pack")
	const selectors = lines.filter(
		(line) => line.product.product_type !== "carat_pack"
	)

	return (
		<section className={`overflow-hidden rounded-xl border border-gray-700 bg-gray-800 shadow-sm ${locked ? "opacity-60" : ""}`}>
			<div className="grid lg:grid-cols-[11.5rem_minmax(17rem,0.85fr)_minmax(22rem,1.35fr)]">
				<header className="flex min-w-0 flex-col justify-center border-b border-gray-700 bg-gray-900/35 px-4 py-4 lg:border-b-0 lg:border-r">
					<div className="flex flex-wrap items-center gap-2">
						<h3 className="text-base font-semibold text-gray-100">{event.name}</h3>
						{event.is_predicted && <PredictedBadge />}
					</div>
					<p className="mt-2 text-sm font-medium text-gray-300">
						{isUndated
							? "Dates unknown"
							: `${formatDate(event.start_date)} – ${formatDate(event.end_date)}`}
					</p>
					<p className="mt-1 text-xs text-gray-500">Campaign purchases</p>
				</header>

				<div className="min-w-0 border-b border-gray-700 px-4 py-3 lg:border-b-0 lg:border-r">
				{packs.length > 0 && (
					<div className="min-w-0">
						<h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-brand">
							<Package className="h-4 w-4 shrink-0" />
							Discounted carat packs
						</h4>
						<div className="grid grid-cols-[minmax(0,1fr)_3.75rem_4rem] gap-2 border-b border-gray-700 pb-1 text-[0.65rem] font-semibold uppercase tracking-wide text-gray-500">
							<span>Pack</span><span className="text-right">Price</span><span className="text-right">Qty</span>
						</div>
						<ul className="divide-y divide-gray-700/80">
							{packs.map((line) => (
								<li
									key={line.product.id}
									className="grid grid-cols-[minmax(0,1fr)_3.75rem_4rem] items-center gap-2 py-2"
								>
									<span className="min-w-0 truncate text-sm text-gray-200">
										{line.product.name}
									</span>
									<span className="text-right text-xs text-gray-400">
										{formatUsd(line.product.usd_cost)}
									</span>
									<input
										type="number"
										min={0}
										max={line.product.max_quantity}
										value={line.quantity}
										disabled={locked}
										aria-label={`Quantity of ${line.product.name}`}
										className="w-full rounded border border-gray-600 bg-gray-900 px-2 py-1 text-right text-sm text-gray-100 disabled:cursor-not-allowed"
										onChange={(e) =>
											onQuantityChange(line, Number(e.target.value))
										}
									/>
								</li>
							))}
						</ul>
					</div>
				)}
				{packs.length === 0 && <p className="text-sm text-gray-500">No discounted packs.</p>}
				</div>

				<div className="min-w-0 px-4 py-3">
				{selectors.length > 0 && (
					<div className="min-w-0">
						<h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-brand">
							<Ticket className="h-4 w-4 shrink-0" />
							Selectors
						</h4>
						<ul className="divide-y divide-gray-700/80">
							{selectors.map((line) => (
								<li
									key={line.product.id}
									className="py-2"
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
												umaBannerData={umaBannerData}
												supportBannerData={supportBannerData}
												targetUma={line.purchase?.target_uma ?? null}
												targetSupport={line.purchase?.target_support ?? null}
												disabled={locked}
												onChange={(target) => onTargetChange(line, target)}
											/>
											{line.product.jp_cutoff_date && <p className="mt-1 text-[0.7rem] text-gray-500">JP cutoff: {formatDate(line.product.jp_cutoff_date)}</p>}
										</div>
									)}
								</li>
							))}
						</ul>
					</div>
				)}
				{selectors.length === 0 && <p className="text-sm text-gray-500">No selector tickets.</p>}
				</div>
			</div>

			{lines.length === 0 && <p className="border-t border-gray-700 px-4 py-3 text-sm text-gray-500">No packs or selectors recorded for this campaign yet.</p>}

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
