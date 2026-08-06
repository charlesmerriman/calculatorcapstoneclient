import { Sparkles } from "lucide-react"
import { useCalculatorData } from "../../services/CalculatorContext"
import { useSelectorPlanner } from "../../hooks/useSelectorPlanner"
import { formatUsd } from "../../utils/formatCurrency"
import { ToggleSwitch } from "../ToggleSwitch"
import { CampaignCard } from "./CampaignCard"
import type { PlannedProduct } from "../../hooks/useSelectorPlanner"
import type { UserPlannedPurchase } from "../../types"

/** A stat tile in the summary strip. */
const Total = ({ label, value }: { label: string; value: string }) => (
	<div className="flex min-w-0 flex-col rounded-lg border border-gray-700 bg-gray-800 px-4 py-2">
		<span className="text-xs uppercase tracking-wide text-gray-500">{label}</span>
		<span className="truncate text-lg font-bold text-gray-100">{value}</span>
	</div>
)

export const Selectors = () => {
	const {
		userStatsData,
		anniversaryEventData,
		userPlannedPurchaseData,
		setUserPlannedPurchaseData,
		setUserStatsData,
		umaBannerData,
		supportBannerData,
	} = useCalculatorData()

	const plan = useSelectorPlanner(
		anniversaryEventData,
		userPlannedPurchaseData,
		userStatsData
	)

	if (!userStatsData) return null

	/**
	 * Upsert one product's planned quantity.
	 *
	 * Quantity 0 removes the row rather than storing a zero: the PATCH deletes
	 * anything absent from the payload, so an explicit zero would be a row that
	 * means nothing and still round-trips through the database.
	 */
	const handleQuantityChange = (line: PlannedProduct, rawQuantity: number): void => {
		const quantity = Math.max(
			0,
			Math.min(Math.floor(rawQuantity) || 0, line.product.max_quantity)
		)

		setUserPlannedPurchaseData((previous) => {
			const withoutThis = previous.filter(
				(purchase) => purchase.product !== line.product.id
			)
			if (quantity === 0) return withoutThis

			const existing = previous.find(
				(purchase) => purchase.product === line.product.id
			)
			if (existing) {
				return [...withoutThis, { ...existing, quantity }]
			}
			// New local row. tempId mirrors the planned-banner convention: high
			// enough not to collide with a server id it will be swapped for on save.
			const nextTempId =
				Math.max(0, ...previous.map((p) => p.tempId ?? p.id ?? 0)) + 1
			return [
				...withoutThis,
				{
					tempId: nextTempId,
					product: line.product.id,
					quantity,
					target_uma: null,
					target_support: null,
				} satisfies UserPlannedPurchase,
			]
		})
	}

	const handleTargetChange = (
		line: PlannedProduct,
		target: { uma: number | null; support: number | null }
	): void => {
		setUserPlannedPurchaseData((previous) =>
			previous.map((purchase) =>
				purchase.product === line.product.id
					? { ...purchase, target_uma: target.uma, target_support: target.support }
					: purchase
			)
		)
	}

	const setStat = (key: "include_purchases_in_projection" | "webstore_bonus") =>
		(checked: boolean): void => {
			setUserStatsData((previous) =>
				previous ? { ...previous, [key]: checked } : previous
			)
		}

	return (
		<div className="mx-2 my-3 flex flex-col gap-4 sm:mx-4">
			<header className="flex flex-col gap-3">
				<div>
					<h1 className="flex items-center gap-2 text-xl font-bold text-brand">
						<Sparkles className="h-5 w-5 shrink-0" />
						Selectors &amp; Purchases
					</h1>
					<p className="mt-1 text-sm text-gray-400">
						Plan what you'd spend at each anniversary. Prices are for reference
						only — nothing here buys anything.
					</p>
				</div>

				<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
					<Total label="Total spend" value={formatUsd(plan.totalUsd)} />
					<Total
						label="Paid carats"
						value={plan.totalPaidCarats.toLocaleString()}
					/>
					<Total label="Uma selectors" value={String(plan.umaSelectors)} />
					<Total label="Support selectors" value={String(plan.supportSelectors)} />
				</div>

				<div className="flex flex-col gap-3 rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 sm:flex-row sm:items-center sm:gap-6">
					<label className="flex flex-1 items-center gap-3">
						<ToggleSwitch
							checked={userStatsData.include_purchases_in_projection}
							onChange={setStat("include_purchases_in_projection")}
							ariaLabel="Include purchases in the calculator projection"
						/>
						<span className="min-w-0 text-sm text-gray-300">
							Include these purchases in the calculator
							<span className="block text-xs text-gray-500">
								Off by default — your banner estimates don't change until you
								switch this on.
							</span>
						</span>
					</label>
					<label className="flex flex-1 items-center gap-3">
						<ToggleSwitch
							checked={userStatsData.webstore_bonus}
							onChange={setStat("webstore_bonus")}
							ariaLabel="Apply the webstore bonus to carat packs"
						/>
						<span className="min-w-0 text-sm text-gray-300">
							Buying through the webstore
							<span className="block text-xs text-gray-500">
								Applies each pack's bonus carats.
							</span>
						</span>
					</label>
				</div>
			</header>

			{plan.campaigns.length === 0 ? (
				<p className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-8 text-center text-sm text-gray-400">
					No campaigns have been added yet.
				</p>
			) : (
				<div className="flex flex-col gap-4">
					{plan.campaigns.map((campaign) => (
						<CampaignCard
							key={campaign.event.id}
							campaign={campaign}
							umaBannerData={umaBannerData}
							supportBannerData={supportBannerData}
							onQuantityChange={handleQuantityChange}
							onTargetChange={handleTargetChange}
						/>
					))}
				</div>
			)}
		</div>
	)
}
