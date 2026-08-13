import type {
	UserPlannedBanner,
	BannerUma,
	BannerSupport
} from "../../types"
import React from "react"
import Select from "react-select"
import type { SingleValue } from "react-select"
import { toast } from "sonner"
import { MLBChanceDisplay } from "./MLBChanceDisplay"
import { MobileBannerCard } from "./MobileBannerCard"
import { compactSelectStyles, mobileBannerSelectStyles } from "../../utils/reactSelectStyles"
import { formatDate } from "../../utils/dateFormat"
import { bannerKey, getPullCountStatus, plannedBannerKey } from "../../utils/bannerHelpers"
import type { BannerKey } from "../../utils/bannerHelpers"
import { PULLS_PER_PITY_COPY } from "../../utils/probabilityCalculations"
import { ExtraCardsBadge } from "./ExtraCardsBadge"

interface StagedBannerRowProps {
	stagedBanner: UserPlannedBanner
	setStagedBanner: (banner: UserPlannedBanner) => void
	onConfirm: () => void
	onDiscard: () => void
	umaBannerData: BannerUma[]
	supportBannerData: BannerSupport[]
	userPlannedBannerData: UserPlannedBanner[]
	/** Every staged row, this one included — it filters itself out by tempId. */
	stagedBanners: UserPlannedBanner[]
}

interface BannerOption {
	value: BannerUma | BannerSupport
	label: string
	key: number
}

export const StagedBannerRow = ({
	stagedBanner,
	setStagedBanner,
	onConfirm,
	onDiscard,
	umaBannerData,
	supportBannerData,
	userPlannedBannerData,
	stagedBanners
}: StagedBannerRowProps) => {
	const bannerType: "Uma" | "Support" = stagedBanner.banner_support
		? "Support"
		: (stagedBanner.initialBannerType ?? "Uma")

	const targetBannerData: BannerUma[] | BannerSupport[] =
		bannerType === "Uma" ? umaBannerData : supportBannerData

	const currentDate = new Date()

	// Match within the type namespace only. targetBannerData is already scoped to
	// bannerType, and uma/support ids are independent — comparing against the
	// other type's id could resolve to an unrelated banner of the same number.
	const selectedBannerId =
		bannerType === "Uma" ? stagedBanner.banner_uma?.id : stagedBanner.banner_support?.id
	const currentBanner = targetBannerData.find((banner) => banner.id === selectedBannerId)

	// Banners this row can't take, and why: those already confirmed on the sheet,
	// plus those claimed by a *different* staged row. Without the second group,
	// two staged rows could hold the same banner all the way to the confirm
	// button, where the second one is rejected — the conflict is worth surfacing
	// in the select instead, while it's still cheap to fix.
	//
	// Keyed by type+id, never by bare id — uma and support banners have independent
	// primary keys, so a bare id would make an uma banner block its same-date
	// support counterpart (see plannedBannerKey).
	const unavailableBanners = new Map<BannerKey, "sheet" | "staged">()
	for (const planned of userPlannedBannerData) {
		const key = plannedBannerKey(planned)
		if (key) unavailableBanners.set(key, "sheet")
	}
	for (const staged of stagedBanners) {
		// This row's own selection is never a conflict with itself.
		if (staged.tempId === stagedBanner.tempId) continue
		const key = plannedBannerKey(staged)
		// "sheet" wins a tie — it's the more actionable of the two messages.
		if (key && !unavailableBanners.has(key)) unavailableBanners.set(key, "staged")
	}

	/** This row's select only ever offers banners of its own type. */
	const optionKey = (option: BannerOption): BannerKey =>
		bannerKey(bannerType, option.value.id)

	const handleBannerSelect = (option: SingleValue<BannerOption>): void => {
		if (!option) return
		const conflict = unavailableBanners.get(optionKey(option))
		if (conflict) {
			toast.error(
				conflict === "sheet"
					? "This banner is already on your sheet."
					: "This banner is already staged in another row."
			)
			return
		}
		if (bannerType === "Uma") {
			setStagedBanner({ ...stagedBanner, banner_uma: option.value as BannerUma, banner_support: undefined })
		} else {
			setStagedBanner({ ...stagedBanner, banner_uma: undefined, banner_support: option.value as BannerSupport })
		}
	}

	const handlePullCountChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
		setStagedBanner({ ...stagedBanner, number_of_pulls: Number(e.target.value) })
	}

	const handleReservedChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
		// Floored and clamped, unlike handlePullCountChange above. This value
		// carries onto the sheet on confirm, where a decimal would reach
		// getExactProbability — which assumes integer trials.
		const parsed = Math.max(0, Math.floor(Number(e.target.value) || 0))
		setStagedBanner({ ...stagedBanner, reserved_copies: parsed })
	}

	const hasBanner = stagedBanner.banner_uma || stagedBanner.banner_support

	// A staged banner isn't on the sheet yet, so useBannerResources hasn't
	// projected an affordability bound for it. Infinity opts out of the "over"
	// state rather than inventing a limit — the field still flags on/off pity,
	// and the real red signal appears once the banner is added to the sheet.
	const pullStatus = getPullCountStatus(stagedBanner.number_of_pulls, Infinity)
	const pullStatusHint =
		pullStatus === "ok"
			? "On a pity threshold — no carats stranded in a partial counter"
			: `Not on a pity threshold (a multiple of ${PULLS_PER_PITY_COPY} pulls)`

	const images = stagedBanner.banner_uma
		? stagedBanner.banner_uma.umas
		: stagedBanner.banner_support
		? stagedBanner.banner_support.support_cards
		: []

	const bannerTimeline =
		stagedBanner.banner_uma?.banner_timeline ??
		stagedBanner.banner_support?.banner_timeline

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
			formatOptionLabel={(option) => {
				const conflict = unavailableBanners.get(optionKey(option))
				return (
					<span className={conflict ? "text-gray-500" : ""}>
						{option.label}
						{conflict && (
							<span className="ml-1 text-xs">
								{conflict === "sheet" ? "(on sheet)" : "(staged)"}
							</span>
						)}
					</span>
				)
			}}
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
		</div>
	) : (
		<span className="text-xs text-gray-600">—</span>
	)

	const confirmButton = (
		<button
			onClick={onConfirm}
			disabled={!hasBanner}
			className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-40"
		>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
				<polyline points="20 6 9 17 4 12" />
			</svg>
			Add to sheet
		</button>
	)

	const pullsInput = (
		<input
			type="number"
			value={stagedBanner.number_of_pulls}
			className={`spin-arrows pull-input pull-input--${pullStatus} w-20`}
			min={0}
			title={pullStatusHint}
			onChange={handlePullCountChange}
		/>
	)
	// Always neutral, never ok/over. A staged banner isn't on the sheet, so
	// useBannerResources hasn't projected which of these copies a selector or a
	// crystal could actually pay for — the same reason pullStatus opts out of
	// "over" above. Colouring it here would be inventing a funding split. The
	// real one, and the "2s 1c" hint, appear once the banner is added.
	const renderReservedInput = (widthClass: string) => (
		<input
			type="number"
			value={stagedBanner.reserved_copies}
			className={`spin-arrows pull-input pull-input--neutral ${widthClass}`}
			min={0}
			title="Copies you'll take with a selector ticket or an SSR crystal instead of pulling. Whether you can afford them is shown once the banner is on the sheet."
			aria-label="Copies obtained without pulling"
			disabled={!hasBanner}
			onChange={handleReservedChange}
		/>
	)

	const chanceDisplay = hasBanner ? (
		<MLBChanceDisplay
			pulls={stagedBanner.number_of_pulls}
			plannedBanner={stagedBanner}
		/>
	) : (
		<div className="w-full rounded-lg border border-gray-700 bg-gray-900/60 py-3 text-center text-xs text-gray-500">Select a banner</div>
	)

	return (
		<>
		<MobileBannerCard
			bannerType={bannerType}
			images={images}
			bannerSelect={mobileBannerSelect}
			dates={dateDisplay}
			summary={confirmButton}
			pullsInput={pullsInput}
			reservedInput={renderReservedInput("w-20")}
			chanceDisplay={chanceDisplay}
			onRemove={onDiscard}
			removeLabel="Discard staged banner"
			removeIcon="discard"
		/>

		{/* Column widths come from .banner-grid (App.css), shared with the header
		    row and BannerRow — never re-declare a width on a cell here. */}
		<div className="banner-grid hidden w-full items-stretch bg-gray-800 h-16 @banner-table:grid">
			{/* === Type badge === */}
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
			<div className="relative flex items-center justify-center gap-1.5 py-1 px-1">
				{images.slice(0, 2).map((img) => (
					<img
						key={img.name}
						src={img.image}
						alt={img.name}
						className={`thumb-banner ${bannerType === "Uma" ? "thumb-banner--uma" : ""}`}
					/>
				))}
				<ExtraCardsBadge hidden={images.length - 2} />
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

			{/* === Add to sheet button (replaces Derived Stats) === */}
			<div className="flex min-w-0 items-center justify-center px-3 py-2">
				<button
					onClick={onConfirm}
					disabled={!hasBanner}
					className="w-full h-full rounded-lg bg-green-700 hover:bg-green-600 text-white font-semibold text-sm transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
						<polyline points="20 6 9 17 4 12" />
					</svg>
					Add to sheet
				</button>
			</div>

			{/* === # Pulls section === */}
			<div className="flex items-center justify-center py-2 px-1 relative">
				<div className="absolute left-0 top-3 bottom-3 w-px bg-gray-700" />
				<div className="absolute right-0 top-3 bottom-3 w-px bg-gray-700" />
				<input
					type="number"
					value={stagedBanner.number_of_pulls}
					className={`spin-arrows pull-input pull-input--${pullStatus} w-14`}
					min={0}
					title={pullStatusHint}
					onChange={handlePullCountChange}
				/>
			</div>

			{/* === Reserved copies === */}
			{/* Keeps py-2, unlike BannerRow's cell: with no funding hint beneath
			    it there is nothing here that needs the extra 8px. */}
			<div className="flex items-center justify-center py-2 px-1 relative">
				<div className="absolute right-0 top-3 bottom-3 w-px bg-gray-700" />
				{renderReservedInput("w-14")}
			</div>

			{/* === MLB chance grid === */}
			<div className="flex items-center justify-center py-2 px-2 min-w-0">
				{hasBanner ? (
					<MLBChanceDisplay
						pulls={stagedBanner.number_of_pulls}
						plannedBanner={stagedBanner}
					/>
				) : (
					<div className="w-full text-center text-xs text-gray-500">Select a banner</div>
				)}
			</div>

			{/* === Discard button === */}
			<button onClick={onDiscard} className="banner-delete-btn">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
					<line x1="18" y1="6" x2="6" y2="18" />
					<line x1="6" y1="6" x2="18" y2="18" />
				</svg>
			</button>
		</div>
		</>
	)
}
