import { useEffect, useRef, useState } from "react"
import { Settings } from "lucide-react"
import { useCalculatorDataSafe } from "../../services/CalculatorContext"
import { ToggleSwitch } from "../ToggleSwitch"
import type { UserStats } from "../../types"

/** The boolean-valued keys of UserStats — the only fields these toggles set. */
type BooleanStatKey = {
	[K in keyof UserStats]: UserStats[K] extends boolean ? K : never
}[keyof UserStats]

/**
 * Each toggle maps to a boolean field on UserStats and controls a slice of the
 * resource projection (see useBannerResources). Kept as data so the panel is a
 * simple map over this list.
 */
const SETTINGS: {
	key: BooleanStatKey
	label: string
	description: string
}[] = [
	{
		key: "monthly_shop_tickets",
		label: "Monthly Shop Tickets",
		description: "Buy 4 uma and 4 support tickets each month.",
	},
	{
		key: "misc_earnings",
		label: "Misc Earnings",
		description: "Roughly 60 carats a day from gifts, team trials, and careers, starting 30 days out.",
	},
	{
		key: "discounted_paid_pulls",
		label: "Discounted Paid Pulls",
		description: "Take the discounted 50-carat pull once a day.",
	},
	{
		key: "full_price_paid_pulls",
		label: "Full-Price Paid Pulls",
		description: "Spend paid carats on normal 150-carat pulls.",
	},
]

export const SettingsMenu = () => {
	const calculatorData = useCalculatorDataSafe()
	const [open, setOpen] = useState(false)
	const containerRef = useRef<HTMLDivElement>(null)

	// Close the popover when clicking outside it (same idiom as ThemePicker).
	useEffect(() => {
		if (!open) return
		const handlePointerDown = (e: PointerEvent) => {
			if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
				setOpen(false)
			}
		}
		document.addEventListener("pointerdown", handlePointerDown)
		return () => document.removeEventListener("pointerdown", handlePointerDown)
	}, [open])

	// Only meaningful once stats exist (app mode). Guests have seeded defaults,
	// so this renders for them too — their toggles just stay in memory.
	const userStatsData = calculatorData?.userStatsData
	const setUserStatsData = calculatorData?.setUserStatsData
	if (!userStatsData || !setUserStatsData) return null

	return (
		<div ref={containerRef} className="relative">
			<button
				onClick={() => setOpen((prev) => !prev)}
				aria-label="Projection settings"
				title="Projection settings"
				className="flex h-9 w-9 items-center justify-center rounded border border-gray-600 text-gray-300 transition hover:border-gray-500 hover:bg-gray-700 hover:text-gray-100"
			>
				<Settings className="h-4 w-4" />
			</button>

			{open && (
				<div className="absolute right-0 top-full mt-1.5 z-50 w-72 rounded border border-gray-600 bg-gray-800 p-3 shadow-lg">
					<h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-brand">
						Projection Settings
					</h3>
					<div className="flex flex-col gap-1">
						{SETTINGS.map(({ key, label, description }) => (
							<div
								key={key}
								className="flex items-start justify-between gap-3 rounded px-1 py-2 hover:bg-gray-700/50"
							>
								<div className="min-w-0">
									<div className="text-sm text-gray-100">{label}</div>
									<div className="text-xs leading-tight text-gray-400">{description}</div>
								</div>
								<div className="shrink-0 pt-0.5">
									<ToggleSwitch
										checked={!!userStatsData[key]}
										onChange={(checked) =>
											setUserStatsData({ ...userStatsData, [key]: checked })
										}
										ariaLabel={label}
									/>
								</div>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	)
}
