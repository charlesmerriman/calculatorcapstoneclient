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
import { bannerKey, getFreePulls, getPullCountStatus, plannedBannerKey } from "../../utils/bannerHelpers"
import type { BannerKey } from "../../utils/bannerHelpers"
import { PULLS_PER_PITY_COPY } from "../../utils/probabilityCalculations"
import { compactSelectStyles } from "../../utils/reactSelectStyles"

interface BannerRowProps {
	plannedBanner: UserPlannedBanner
	userStatsData: UserStats
	clubRankData: ClubRank[]
	teamTrialsRankData: TeamTrialsRank[]
	championsMeetingRankData: ChampionsMeetingRank[]
	userPlannedBannerData: UserPlannedBanner[]
	umaBannerData: BannerUma[]
	supportBannerData: BannerSupport[]
	caratsAvailableForThisBanner: number
	maxPossiblePullsForThisBanner: number
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
	caratsAvailableForThisBanner,
	maxPossiblePullsForThisBanner,
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
		: maxPossiblePullsForThisBanner

	// Round the *displayed* estimate DOWN to the nearest ten carats (ones place
	// is always 0, never a decimal). Flooring rather than rounding to nearest
	// avoids overstating: rounding 145 up to 150 would imply a pull is
	// affordable while "Max Pulls" (which floors 145/150 to 0) says it isn't.
	// Presentation-only — the raw caratsAvailableForThisBanner still drives the
	// max-pulls math above, so this never affects how many pulls are allowed.
	const displayCarats =
		maxPossiblePulls === "Passed"
			? 0
			: Math.floor(caratsAvailableForThisBanner / 10) * 10

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

	const formatDate = (dateStr: string): string => {
		const date = new Date(dateStr)
		return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
	}

	const bannerSelect = (
		<Select<BannerOption>
			className="w-full"
			styles={{
				...(compactSelectStyles as import("react-select").StylesConfig<BannerOption, false>),
				menuPortal: (base) => ({ ...base, zIndex: 9999 })
			}}
			menuPortalTarget={document.body}
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

	const dateDisplay = bannerTimeline ? (
		<div className="space-y-0.5 text-xs text-gray-400">
			<div>Start: <span className="text-gray-100">{formatDate(bannerTimeline.start_date)}</span></div>
			<div>End: <span className="text-gray-100">{formatDate(bannerTimeline.end_date)}</span></div>
			{bannerTimeline.is_predicted && <PredictedBadge className="mt-0.5" />}
		</div>
	) : (
		<span className="text-xs text-gray-600">—</span>
	)

	const statsDisplay = (
		<div className="grid grid-cols-3 overflow-hidden rounded-lg border border-gray-600 bg-gray-700">
			<div className="flex flex-col items-center justify-center px-2 py-2">
				<span className="banner-stat-box-label">Free Pulls</span>
				<span className="banner-stat-box-value">{freePulls}</span>
			</div>
			<div className="flex flex-col items-center justify-center border-x border-gray-600 px-2 py-2">
				<span className="banner-stat-box-label">Carats (Est.)</span>
				<span className="banner-stat-box-value text-brand">{displayCarats.toLocaleString()}</span>
			</div>
			<div className="flex flex-col items-center justify-center px-2 py-2">
				<span className="banner-stat-box-label">Max Pulls</span>
				<span className="banner-stat-box-value">{maxPossiblePulls}</span>
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

	const chanceDisplay = hasBanner ? (
		<MLBChanceDisplay
			pulls={plannedBanner.number_of_pulls}
			plannedBanner={plannedBanner}
		/>
	) : (
		<div className="w-full rounded-lg border border-gray-700 bg-gray-900/60 py-3 text-center text-xs text-gray-500">Select a banner</div>
	)

	return (
		<>
		<MobileBannerCard
			bannerType={bannerType}
			images={images}
			bannerSelect={bannerSelect}
			dates={dateDisplay}
			summary={statsDisplay}
			pullsInput={pullsInput}
			chanceDisplay={chanceDisplay}
			onRemove={handleDeleteBannerClick}
			removeLabel="Delete banner"
		/>

		<div className="hidden w-full items-stretch bg-gray-800 h-16 md:flex">
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
			<div className="w-36 shrink-0 flex items-center justify-center gap-1.5 py-1 px-1">
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
			<div className="w-44 shrink-0 flex items-center justify-center py-2 px-2">
				{bannerSelect}
			</div>

			{/* === Start / End Date === */}
			<div className="w-32 shrink-0 flex flex-col items-start justify-center gap-0.5 py-2 px-2 text-xs text-gray-400 relative">
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
			<div className="w-65 shrink-0 flex items-center justify-center px-3 py-2">
				<div className="flex items-stretch rounded-lg bg-gray-700 border border-gray-600 overflow-hidden w-full">
					<div className="flex flex-col items-center justify-center px-3 py-1.5 flex-1">
						<span className="banner-stat-box-label">Free Pulls</span>
						<span className="banner-stat-box-value">{freePulls}</span>
					</div>
					<div className="w-px bg-gray-600 self-stretch" />
					<div className="flex flex-col items-center justify-center px-3 py-1.5 flex-1">
						<span className="banner-stat-box-label">Carats (Est.)</span>
						<span className="banner-stat-box-value text-brand">{displayCarats.toLocaleString()}</span>
					</div>
					<div className="w-px bg-gray-600 self-stretch" />
					<div className="flex flex-col items-center justify-center px-3 py-1.5 flex-1">
						<span className="banner-stat-box-label">Max Pulls</span>
						<span className="banner-stat-box-value">{maxPossiblePulls}</span>
					</div>
				</div>
			</div>

			{/* === # Pulls section === */}
			<div className="w-22.5 shrink-0 flex items-center justify-center py-2 px-2 relative">
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
			<div className="flex-1 flex items-center justify-center py-2 px-2 min-w-0">
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
