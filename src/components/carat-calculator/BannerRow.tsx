import type {
	ChampionsMeetingRank,
	ClubRank,
	TeamTrialsRank,
	UserPlannedBanner,
	UserStats,
	BannerUma,
	BannerSupport
} from "../../types"
import React from "react"
import { startOfDay } from "date-fns"
import Select from "react-select"
import type { SingleValue } from "react-select"
import { toast } from "sonner"
import { MLBChanceDisplay } from "./MLBChanceDisplay"
import { MobileBannerCard } from "./MobileBannerCard"
import PredictedBadge from "../PredictedBadge"
import { formatDate } from "../../utils/dateFormat"
import { bannerKey, getFreePulls, getPullCountStatus, plannedBannerKey } from "../../utils/bannerHelpers"
import type { BannerKey } from "../../utils/bannerHelpers"
import type { BannerResources } from "../../hooks/useBannerResources"
import { PULLS_PER_PITY_COPY } from "../../utils/probabilityCalculations"
import { compactSelectStyles, mobileBannerSelectStyles } from "../../utils/reactSelectStyles"

interface BannerRowProps {
	plannedBanner: UserPlannedBanner
	userStatsData: UserStats
	clubRankData: ClubRank[]
	teamTrialsRankData: TeamTrialsRank[]
	championsMeetingRankData: ChampionsMeetingRank[]
	userPlannedBannerData: UserPlannedBanner[]
	umaBannerData: BannerUma[]
	supportBannerData: BannerSupport[]
	/**
	 * This banner's projection snapshot (carats, max pulls, pull breakdown).
	 * Passed whole rather than as individual scalars so adding a stat to the
	 * derived-stats strip doesn't churn this signature every time.
	 */
	resources: BannerResources
	setUserPlannedBannerData: React.Dispatch<
		React.SetStateAction<UserPlannedBanner[]>
	>
	initialBannerType?: "Uma" | "Support"
}

interface BannerOption {
	value: BannerUma | BannerSupport
	label: string
	key: number
}

export const BannerRow = ({
	plannedBanner,
	userPlannedBannerData,
	umaBannerData,
	supportBannerData,
	resources,
	setUserPlannedBannerData,
	initialBannerType
}: BannerRowProps) => {
	const bannerType: "Uma" | "Support" = plannedBanner.banner_support ? "Support" : (initialBannerType ?? "Uma")
	const targetBannerData: BannerUma[] | BannerSupport[] = bannerType === "Uma" ? umaBannerData : supportBannerData

	// Match within the type namespace only. targetBannerData is already scoped to
	// bannerType, and uma/support ids are independent — comparing against the
	// other type's id could resolve to an unrelated banner of the same number.
	const selectedBannerId =
		bannerType === "Uma" ? plannedBanner.banner_uma?.id : plannedBanner.banner_support?.id
	const currentBanner = targetBannerData.find((banner) => banner.id === selectedBannerId)

	const currentDate = new Date()

	// The pull economics (free/paid carats, tickets, discounts) are computed
	// centrally in useBannerResources → applyPullStrategy; here we only apply the
	// "Passed" gate for banners that have already ended. The cutoff is the START
	// of today (local midnight), matching the projection's stable anchor — a
	// banner ending *today* is still active, so it shows an estimate.
	const bannerEndDateStr =
		plannedBanner.banner_uma?.banner_timeline.end_date ??
		plannedBanner.banner_support?.banner_timeline.end_date
	const bannerHasEnded =
		!!bannerEndDateStr &&
		new Date(bannerEndDateStr).getTime() < startOfDay(new Date()).getTime()

	const maxPossiblePulls: number | "Passed" = bannerHasEnded
		? "Passed"
		: resources.maxPossiblePulls

	// Round a *displayed* carat estimate DOWN to the nearest ten (ones place is
	// always 0, never a decimal). Flooring rather than rounding to nearest
	// avoids overstating: rounding 145 up to 150 would imply a pull is
	// affordable while "Max Pulls" (which floors 145/150 to 0) says it isn't.
	// Presentation-only — the raw balances still drive the max-pulls math, so
	// this never affects how many pulls are allowed. A passed banner shows 0:
	// its resources were spent or expired, so an estimate would be misleading.
	const toDisplayCarats = (carats: number): number =>
		maxPossiblePulls === "Passed" ? 0 : Math.floor(carats / 10) * 10

	const displayFreeCarats = toDisplayCarats(resources.freeCarats)
	const displayPaidCarats = toDisplayCarats(resources.paidCarats)

	// Ticket and paid-pull counts come straight from the strategy's breakdown
	// rather than being re-derived here: it already resolved which ticket type
	// matches this banner, and picking uma-vs-support again in the component
	// would be a second place to get the no-cross-substitution rule wrong.
	// Zeroed for a passed banner, mirroring the carat boxes above.
	const { tickets: ticketPulls, paidPulls } =
		maxPossiblePulls === "Passed"
			? { tickets: 0, paidPulls: 0 }
			: resources.maxPullBreakdown

	const updateBannerInList = (
		updater: (banner: UserPlannedBanner) => UserPlannedBanner
	): UserPlannedBanner[] => {
		return userPlannedBannerData.map((mappedBannerData) => {
			const isMatch =
				(mappedBannerData.id !== undefined &&
					mappedBannerData.id === plannedBanner.id) ||
				(mappedBannerData.tempId !== undefined &&
					mappedBannerData.tempId === plannedBanner.tempId)
			return isMatch ? updater(mappedBannerData) : mappedBannerData
		})
	}

	const handleDeleteBannerClick = (): void => {
		const confirmed = window.confirm("Are you sure you want to delete this banner?")
		if (!confirmed) return
		const updated = userPlannedBannerData.filter(
			(b) =>
				b.tempId ? b.tempId !== plannedBanner.tempId : b.id !== plannedBanner.id
		)
		setUserPlannedBannerData(updated)
	}

	// Keys of banners already on the sheet, excluding this row's own current selection.
	// Keyed by type+id, never by bare id — uma and support banners have independent
	// primary keys, so a bare id would make an uma banner block its same-date
	// support counterpart (see plannedBannerKey).
	const alreadyPlannedBannerKeys = new Set(
		userPlannedBannerData
			.filter((b) => {
				const isCurrentRow =
					(b.id !== undefined && b.id === plannedBanner.id) ||
					(b.tempId !== undefined && b.tempId === plannedBanner.tempId)
				return !isCurrentRow
			})
			.map(plannedBannerKey)
			.filter((key): key is BannerKey => key !== null)
	)

	/** This row's select only ever offers banners of its own type. */
	const optionKey = (option: BannerOption): BannerKey =>
		bannerKey(bannerType, option.value.id)

	const handleBannerSelect = (option: SingleValue<BannerOption>): void => {
		if (!option) return
		if (alreadyPlannedBannerKeys.has(optionKey(option))) {
			toast.error("This banner is already on your sheet.")
			return
		}
		const updated = updateBannerInList((banner) => {
			if (bannerType === "Uma") {
				return { ...banner, banner_uma: option.value as BannerUma, banner_support: undefined }
			}
			return { ...banner, banner_uma: undefined, banner_support: option.value as BannerSupport }
		})
		const sorted = updated.sort((a, b) => {
			const aDate = new Date(
				a.banner_uma?.banner_timeline.start_date ?? a.banner_support!.banner_timeline.start_date
			)
			const bDate = new Date(
				b.banner_uma?.banner_timeline.start_date ?? b.banner_support!.banner_timeline.start_date
			)
			return aDate.getTime() - bDate.getTime()
		})
		setUserPlannedBannerData(sorted)
	}

	const handlePullCountChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
		// Sanitise to a whole, non-negative number of pulls. The floor matters:
		// a typed decimal like "2.5" would flow into getExactProbability (which
		// assumes integer trials) and into the carat deduction, corrupting both.
		//
		// Deliberately NOT capped at maxPossiblePulls. Planning past what you can
		// afford is a legitimate thing to want to see — applyPullStrategy turns
		// the shortfall into a negative carat balance that carries to later
		// banners, and pullStatus below surfaces it as a red field rather than
		// silently rewriting what the user typed.
		const parsed = Math.floor(Number(e.target.value))
		const nonNegative = Number.isFinite(parsed) ? Math.max(0, parsed) : 0

		const updated = updateBannerInList((banner) => ({
			...banner,
			number_of_pulls: nonNegative
		}))
		setUserPlannedBannerData(updated)
	}

	// A banner that has already ended can fund nothing, so its bound is 0 — any
	// leftover pulls on it correctly read as unachievable.
	const pullUpperBound = typeof maxPossiblePulls === "number" ? maxPossiblePulls : 0
	const pullStatus = getPullCountStatus(
		plannedBanner.number_of_pulls,
		pullUpperBound
	)

	const hasBanner = plannedBanner.banner_uma || plannedBanner.banner_support

	const freePulls = getFreePulls(plannedBanner)

	const images = plannedBanner.banner_uma
		? plannedBanner.banner_uma.umas
		: plannedBanner.banner_support
		? plannedBanner.banner_support.support_cards
		: []

	const bannerTimeline =
		plannedBanner.banner_uma?.banner_timeline ??
		plannedBanner.banner_support?.banner_timeline

	const renderBannerSelect = (styles: import("react-select").StylesConfig<BannerOption, false>) => (
		<Select<BannerOption>
			className="w-full"
			styles={{
				...styles,
				menuPortal: (base) => ({ ...base, zIndex: 9999 })
			}}
			menuPortalTarget={document.body}
			menuPosition="fixed"
			placeholder={`Target ${bannerType} Banner`}
			value={
				currentBanner
					? { value: currentBanner as BannerUma | BannerSupport, label: currentBanner.name, key: currentBanner.id }
					: null
			}
			onChange={handleBannerSelect}
			formatOptionLabel={(option) => (
				<span className={alreadyPlannedBannerKeys.has(optionKey(option)) ? "text-gray-500" : ""}>
					{option.label}
					{alreadyPlannedBannerKeys.has(optionKey(option)) && (
						<span className="ml-1 text-xs">(on sheet)</span>
					)}
				</span>
			)}
			options={targetBannerData
				.filter(
					(banner) =>
						(bannerType === "Uma" ? "umas" in banner : "support_cards" in banner) &&
						new Date(banner.banner_timeline.end_date) > currentDate
				)
				.map((banner) => ({
					value: banner,
					label: banner.name,
					key: banner.id
				}))}
		/>
	)

	const bannerSelect = renderBannerSelect(
		compactSelectStyles as import("react-select").StylesConfig<BannerOption, false>
	)
	const mobileBannerSelect = renderBannerSelect(
		mobileBannerSelectStyles as import("react-select").StylesConfig<BannerOption, false>
	)

	const dateDisplay = bannerTimeline ? (
		<div className="grid grid-cols-[max-content_max-content] gap-x-3 text-xs text-gray-400 sm:gap-x-10 sm:text-sm">
			<div>Start: <span className="text-gray-100">{formatDate(bannerTimeline.start_date)}</span></div>
			<div>End: <span className="text-gray-100">{formatDate(bannerTimeline.end_date)}</span></div>
			{bannerTimeline.is_predicted && <PredictedBadge className="mt-0.5" />}
		</div>
	) : (
		<span className="text-xs text-gray-600">—</span>
	)

	// Single source of truth for the derived-stats strip. Both the mobile card
	// and the desktop grid render from this list, so a stat is added or reworded
	// in ONE place — two hand-synced copies of the same boxes is exactly the
	// drift that leaves one layout a stat behind the other.
	// Labels follow the source spreadsheet this calculator is modelled on
	// ("Carat Est.", "Paid Carat Est.", "Free/Tickets/Paid"), so users coming
	// from the sheet read the same vocabulary. `title` carries the long form.
	const derivedStats: {
		label: string
		value: string
		title: string
		valueClass?: string
	}[] = [
		{
			// Unspaced slashes, matching formatDate's a/b/c. No thousands separators
			// here — these are small counts and commas would collide with the slashes.
			label: "Free/Tickets/Paid",
			value: `${freePulls || 0}/${ticketPulls}/${paidPulls}`,
			title: "Pulls you don't pay free carats for: the banner's free pulls, matching tickets, and pulls funded by paid carats",
		},
		{
			label: "Carat Est.",
			value: displayFreeCarats.toLocaleString(),
			title: "Estimated free (earned) carats available for this banner",
			valueClass: "text-brand",
		},
		{
			label: "Paid Carat Est.",
			value: displayPaidCarats.toLocaleString(),
			title: "Estimated paid (purchased) carats available for this banner",
			valueClass: "text-brand",
		},
		{
			label: "Max Pulls",
			value: String(maxPossiblePulls),
			title: "The most pulls this banner could support if every available resource went into it",
		},
	]

	const mobileStatCell = (stat: typeof derivedStats[number], index: number) => (
		<div
			key={stat.label}
			title={stat.title}
			className={`flex flex-col items-center justify-center px-2 py-2${index % 2 === 0 ? " border-r border-gray-600" : ""}${index < 2 ? " border-b border-gray-600" : ""}`}
		>
			<span className="banner-stat-box-label">{stat.label}</span>
			<span className={`banner-stat-box-value ${stat.valueClass ?? ""}`}>{stat.value}</span>
		</div>
	)

	// Phone cards use a true 2x2 estimate grid, so "Paid Carat Est." and
	// "Max Pulls" share the second row. Once the card is wide enough, the
	// reference-style three-across strip returns and shares its lower row with
	// the odds display.
	const statsDisplay = (
		<div className="overflow-hidden rounded-lg border border-gray-600 bg-gray-700">
			<div className="sm:hidden">
				<div className="grid grid-cols-2">
					{derivedStats.map(mobileStatCell)}
				</div>
				<div className="border-t border-gray-600 p-2">
					{hasBanner ? (
						<MLBChanceDisplay pulls={plannedBanner.number_of_pulls} plannedBanner={plannedBanner} />
					) : (
						<div className="py-3 text-center text-xs text-gray-500">Select a banner</div>
					)}
				</div>
			</div>
			<div className="hidden sm:block">
				<div className="grid grid-cols-3 divide-x divide-gray-600">
					{derivedStats.slice(0, 3).map((stat) => (
						<div key={stat.label} title={stat.title} className="flex flex-col items-center justify-center px-2 py-2">
						<span className="banner-stat-box-label">{stat.label}</span>
						<span className={`banner-stat-box-value ${stat.valueClass ?? ""}`}>{stat.value}</span>
					</div>
				))}
				</div>
				<div className="grid grid-cols-3 border-t border-gray-600">
					<div title={derivedStats[3].title} className="flex flex-col items-center justify-center border-r border-gray-600 px-2 py-2">
						<span className="banner-stat-box-label">{derivedStats[3].label}</span>
						<span className={`banner-stat-box-value ${derivedStats[3].valueClass ?? ""}`}>{derivedStats[3].value}</span>
					</div>
					<div className="col-span-2 p-2">
						{hasBanner ? (
							<MLBChanceDisplay pulls={plannedBanner.number_of_pulls} plannedBanner={plannedBanner} />
						) : (
							<div className="py-3 text-center text-xs text-gray-500">Select a banner</div>
						)}
					</div>
				</div>
			</div>
		</div>
	)

	// WCAG 1.4.1 — color can't be the only carrier of this state. The same
	// information goes out as a tooltip and, for the failure case, as
	// aria-invalid, so it survives colorblindness and screen readers.
	const pullStatusHint =
		pullStatus === "over"
			? `More pulls than you can afford here (max ${pullUpperBound})`
			: pullStatus === "ok"
			? "On a pity threshold — no carats stranded in a partial counter"
			: `Not on a pity threshold (a multiple of ${PULLS_PER_PITY_COPY} pulls)`

	const pullsInput = (
		<input
			type="number"
			value={plannedBanner.number_of_pulls}
			className={`spin-arrows pull-input pull-input--${pullStatus} w-20`}
			min={0}
			title={pullStatusHint}
			aria-invalid={pullStatus === "over"}
			onChange={handlePullCountChange}
		/>
	)

	return (
		<>
		<MobileBannerCard
			bannerType={bannerType}
			images={images}
			bannerSelect={mobileBannerSelect}
			dates={dateDisplay}
			summary={statsDisplay}
			pullsInput={pullsInput}
			chanceDisplay={null}
			onRemove={handleDeleteBannerClick}
			removeLabel="Delete banner"
		/>

		{/* Column widths come from .banner-grid (App.css), shared with the header
		    row and StagedBannerRow — never re-declare a width on a cell here. */}
		<div className="banner-grid hidden w-full items-stretch bg-gray-800 h-16 @banner-table:grid">
			{/* === Type badge (square block on left) === */}
			<div
				className={`banner-type-tab ${
					bannerType === "Uma" ? "banner-type-tab--uma" : "banner-type-tab--support"
				}`}
			>
				<span className="text-xs font-bold tracking-wide">
					{bannerType === "Uma" ? "UMA" : "SUPPORT"}
				</span>
				{bannerType === "Uma" ? (
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-5 h-5 opacity-90">
						<path d="M5 3v9a7 7 0 0 0 14 0V3" />
						<line x1="5" y1="3" x2="5" y2="6" />
						<line x1="19" y1="3" x2="19" y2="6" />
					</svg>
				) : (
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 opacity-90">
						<circle cx="9" cy="7" r="3" />
						<circle cx="15" cy="7" r="3" />
						<path d="M3 21v-1a6 6 0 0 1 9.5-4.9" />
						<path d="M12 21v-1a6 6 0 0 1 9-5.4" />
					</svg>
				)}
			</div>

			{/* === Images section === */}
			<div className="flex items-center justify-center gap-1.5 py-1 px-1">
				{images.slice(0, 2).map((img) => (
					<img
						key={img.name}
						src={img.image}
						alt={img.name}
						className={`thumb-banner ${bannerType === "Uma" ? "thumb-banner--uma" : ""}`}
					/>
				))}
			</div>

			{/* === Banner select === */}
			<div className="flex items-center justify-center py-2 px-2">
				{bannerSelect}
			</div>

			{/* === Start / End Date === */}
			<div className="flex min-w-0 flex-col items-start justify-center gap-0.5 py-2 px-1 text-xs text-gray-400 relative">
				<div className="absolute right-0 top-3 bottom-3 w-px bg-gray-700" />
				{bannerTimeline ? (
					<>
						<span>Start: <span className="text-gray-100">{formatDate(bannerTimeline.start_date)}</span></span>
						<span>End: <span className="text-gray-100">{formatDate(bannerTimeline.end_date)}</span></span>
					</>
				) : (
					<span className="text-gray-600">—</span>
				)}
			</div>

			{/* === Derived Stats section === */}
			{/* px-1 and compact stat padding keep the four boxes within this tighter
			    track without clipping their labels. */}
			<div className="flex min-w-0 items-center justify-center px-1 py-2">
				{/* Same `derivedStats` list as the mobile card above — one strip
				    instead of 2x2, with rule dividers between the boxes. */}
				<div className="flex items-stretch rounded-lg bg-gray-700 border border-gray-600 overflow-hidden w-full">
					{derivedStats.map((stat, statIndex) => (
						<React.Fragment key={stat.label}>
							{statIndex > 0 && <div className="w-px bg-gray-600 self-stretch" />}
							<div title={stat.title} className="flex flex-col items-center justify-center px-1 py-1.5 flex-1">
								<span className="banner-stat-box-label">{stat.label}</span>
								<span className={`banner-stat-box-value ${stat.valueClass ?? ""}`}>{stat.value}</span>
							</div>
						</React.Fragment>
					))}
				</div>
			</div>

			{/* === # Pulls section === */}
			<div className="flex items-center justify-center py-2 px-1 relative">
				<div className="absolute left-0 top-3 bottom-3 w-px bg-gray-700" />
				<div className="absolute right-0 top-3 bottom-3 w-px bg-gray-700" />
				<input
					type="number"
					value={plannedBanner.number_of_pulls}
					className={`spin-arrows pull-input pull-input--${pullStatus} w-16`}
					min={0}
					title={pullStatusHint}
					aria-invalid={pullStatus === "over"}
					onChange={handlePullCountChange}
				/>
			</div>

			{/* === MLB chance grid === */}
			<div className="flex items-center justify-center py-2 px-2 min-w-0">
				{hasBanner ? (
					<MLBChanceDisplay
						pulls={plannedBanner.number_of_pulls}
						plannedBanner={plannedBanner}
					/>
				) : (
					<div className="w-full text-center text-xs text-gray-500">Select a banner</div>
				)}
			</div>

			{/* === Delete button === */}
			<button onClick={handleDeleteBannerClick} className="banner-delete-btn">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
					<polyline points="3 6 5 6 21 6" />
					<path d="M19 6l-1 14H6L5 6" />
					<path d="M10 11v6" />
					<path d="M14 11v6" />
					<path d="M9 6V4h6v2" />
				</svg>
			</button>
		</div>
		</>
	)
}
