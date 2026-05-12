import { useState } from "react"
import Select from "react-select"
import type { SingleValue } from "react-select"
import { Gem } from "lucide-react"
import { useCalculatorData } from "../../services/CalculatorContext"
import { useUncapCrystals } from "../../hooks/useUncapCrystals"
import { compactSelectStyles } from "../../utils/reactSelectStyles"
import type { BannerTimelineForViewing } from "../../types"

interface DateOption {
	value: string
	label: string
}

const iconCls = "w-4 h-4 shrink-0 text-brand"

// Cell showing a value (or placeholder when no date selected) with optional colored background.
const CrystalCell = ({
	value,
	selected,
	green,
}: {
	value: number
	selected: boolean
	green: boolean
}) => (
	<div
		className={[
			"flex items-center justify-center py-1.5 text-sm font-bold rounded",
			green
				? "bg-green-900/60 text-green-300 border border-green-700"
				: "bg-gray-700 text-gray-300 border border-gray-600",
		].join(" ")}
	>
		{selected ? value.toLocaleString() : "—"}
	</div>
)

export const UncapCrystalsPanel = () => {
	const { userStatsData, eventRewardsData, organizedTimelineData } = useCalculatorData()
	const [selectedEndDate, setSelectedEndDate] = useState<string | null>(null)

	const crystals = useUncapCrystals(userStatsData, eventRewardsData, selectedEndDate)

	const now = new Date()

	// Filter organizedTimelineData to BannerTimelineForViewing entries only,
	// using a structural type guard — "banner_umas" is unique to that interface.
	const bannerOptions: DateOption[] = organizedTimelineData
		.filter((event): event is BannerTimelineForViewing => "banner_umas" in event)
		.filter((t) => new Date(t.end_date) >= now)
		.map((t) => ({ value: t.end_date, label: t.name }))

	const selectedOption = bannerOptions.find((o) => o.value === selectedEndDate) ?? null

	return (
		<div className="card-panel p-3">
			<h3 className="font-semibold text-sm text-brand mb-2 flex items-center justify-center gap-1.5">
				<Gem className={iconCls} />
				Uncap Crystals
			</h3>

			<Select<DateOption>
				styles={compactSelectStyles}
				menuPortalTarget={document.body}
				placeholder="Select Banner Date for Estimate"
				options={bannerOptions}
				value={selectedOption}
				onChange={(opt: SingleValue<DateOption>) =>
					setSelectedEndDate(opt ? opt.value : null)
				}
			/>

			<div className="mt-2 grid grid-cols-2 gap-2">
				{/* Column headers */}
				<div className="text-xs text-gray-400 text-center font-semibold">SSR Crystals</div>
				<div className="text-xs text-gray-400 text-center font-semibold">SR Crystals</div>

				{/* Crystal rows (green) */}
				<CrystalCell value={crystals.ssrCrystals} selected={!!selectedEndDate} green />
				<CrystalCell value={crystals.srCrystals} selected={!!selectedEndDate} green />

				{/* Shard rows (neutral) — color differentiation makes the row label redundant */}
				<CrystalCell value={crystals.ssrShards} selected={!!selectedEndDate} green={false} />
				<CrystalCell value={crystals.srShards} selected={!!selectedEndDate} green={false} />
			</div>
		</div>
	)
}
