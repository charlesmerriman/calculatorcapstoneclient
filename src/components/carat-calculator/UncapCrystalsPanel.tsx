import { useState } from "react"
import Select from "react-select"
import type { SingleValue } from "react-select"
import { Gem } from "lucide-react"
import { useCalculatorData } from "../../services/CalculatorContext"
import { useUncapCrystals } from "../../hooks/useUncapCrystals"
import { compactSelectStyles } from "../../utils/reactSelectStyles"
import { formatDate } from "../../utils/dateFormat"
import { isBannerTimeline } from "../../types"

interface DateOption {
	value: string
	label: string
}

const iconCls = "w-4 h-4 shrink-0 text-brand"

// Cell showing a value (or placeholder when no date selected) with optional colored background.
const CrystalCell = ({ value, selected, green, className = "" }: { value: number; selected: boolean; green: boolean; className?: string }) => (
	<div
		className={[
			"flex items-center justify-center px-2 py-1.5 text-sm font-bold",
			green ? "bg-green-900/60 text-green-300" : "bg-gray-700 text-gray-300",
			className,
		].join(" ")}
	>
		{selected ? value.toLocaleString() : "—"}
	</div>
)

export const UncapCrystalsPanel = () => {
	const { userStatsData, gameEventsData, championsMeetingData, championsMeetingRankData, leagueOfHeroesData, leagueOfHeroesRankData, organizedTimelineData } =
		useCalculatorData()
	const [selectedEndDate, setSelectedEndDate] = useState<string | null>(null)

	const crystals = useUncapCrystals(
		userStatsData,
		gameEventsData,
		championsMeetingData,
		championsMeetingRankData,
		leagueOfHeroesData,
		leagueOfHeroesRankData,
		selectedEndDate,
	)

	const now = new Date()

	// Filter organizedTimelineData to BannerTimelineForViewing entries only.
	// This used to test for "banner_umas" structurally; it narrows on the
	// backend's event_type tag now (see isBannerTimeline in types/calculator).
	const bannerOptions: DateOption[] = organizedTimelineData
		.filter(isBannerTimeline)
		.filter((t) => new Date(t.end_date) >= now)
		.map((t) => ({
			value: t.end_date,
			label: formatDate(t.end_date),
		}))

	const selectedOption = bannerOptions.find((o) => o.value === selectedEndDate) ?? null

	return (
		// Capped and centred while the income panel is compact, matching the
		// blocks above it — see the rank grid in IncomeForm.
		<div className="mx-auto max-w-[34rem] p-4 @income-wide:max-w-none @income-wide:p-5">
			<h3 className="font-semibold text-sm text-brand mb-2 flex items-center justify-center gap-1.5">
				<Gem className={iconCls} />
				Uncap Crystals
			</h3>

			<Select<DateOption>
				styles={compactSelectStyles}
				menuPortalTarget={document.body}
				menuPosition="fixed"
				placeholder="Select Banner Date for Estimate"
				options={bannerOptions}
				value={selectedOption}
				onChange={(opt: SingleValue<DateOption>) => setSelectedEndDate(opt ? opt.value : null)}
			/>

			<div className="mt-3 grid grid-cols-2 overflow-hidden rounded-lg border border-gray-700">
				{/* Column headers */}
				<div className="border-b border-r border-gray-700 px-2 py-1.5 text-center text-xs font-semibold text-gray-400">SSR Crystals/Shards</div>
				<div className="border-b border-gray-700 px-2 py-1.5 text-center text-xs font-semibold text-gray-400">SR Crystals/Shards</div>

				{/* Crystal rows (green) */}
				<CrystalCell value={crystals.ssrCrystals} selected={!!selectedEndDate} green className="border-r border-b border-gray-700" />
				<CrystalCell value={crystals.srCrystals} selected={!!selectedEndDate} green className="border-b border-gray-700" />

				{/* Shard rows (neutral) — color differentiation makes the row label redundant */}
				<CrystalCell value={crystals.ssrShards} selected={!!selectedEndDate} green={false} className="border-r border-gray-700" />
				<CrystalCell value={crystals.srShards} selected={!!selectedEndDate} green={false} />
			</div>
		</div>
	)
}
