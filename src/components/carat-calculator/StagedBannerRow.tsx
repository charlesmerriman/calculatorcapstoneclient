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
import { compactSelectStyles } from "../../utils/reactSelectStyles"

interface StagedBannerRowProps {
	stagedBanner: UserPlannedBanner
	setStagedBanner: (banner: UserPlannedBanner) => void
	onConfirm: () => void
	onDiscard: () => void
	umaBannerData: BannerUma[]
	supportBannerData: BannerSupport[]
	userPlannedBannerData: UserPlannedBanner[]
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
	userPlannedBannerData
}: StagedBannerRowProps) => {
	const bannerType: "Uma" | "Support" = stagedBanner.banner_support
		? "Support"
		: (stagedBanner.initialBannerType ?? "Uma")

	const targetBannerData: BannerUma[] | BannerSupport[] =
		bannerType === "Uma" ? umaBannerData : supportBannerData

	const currentDate = new Date()

	const currentBanner = targetBannerData.find(
		(banner) =>
			banner.id === stagedBanner.banner_uma?.id ||
			banner.id === stagedBanner.banner_support?.id
	)

	// IDs of banners already confirmed on the sheet — the staged banner can't duplicate any of them.
	const alreadyPlannedBannerIds = new Set(
		userPlannedBannerData
			.map((b) => b.banner_uma?.id ?? b.banner_support?.id)
			.filter((id): id is number => id !== undefined)
	)

	const handleBannerSelect = (option: SingleValue<BannerOption>): void => {
		if (!option) return
		if (alreadyPlannedBannerIds.has(option.value.id)) {
			toast.error("This banner is already on your sheet.")
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

	const hasBanner = stagedBanner.banner_uma || stagedBanner.banner_support

	const images = stagedBanner.banner_uma
		? stagedBanner.banner_uma.umas
		: stagedBanner.banner_support
		? stagedBanner.banner_support.support_cards
		: []

	const bannerTimeline =
		stagedBanner.banner_uma?.banner_timeline ??
		stagedBanner.banner_support?.banner_timeline

	const formatDate = (dateStr: string): string => {
		const date = new Date(dateStr)
		return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
	}

	return (
		<div className="w-full flex items-stretch bg-gray-800 h-[64px]">
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
			<div className="w-36 shrink-0 flex items-center justify-center gap-1.5 py-1 px-1">
				{images.slice(0, 2).map((img) => (
					<img
						key={img.name}
						src={img.image}
						alt={img.name}
						className="thumb-banner"
					/>
				))}
			</div>

			{/* === Banner select === */}
			<div className="w-44 shrink-0 flex items-center justify-center py-2 px-2">
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
						<span className={alreadyPlannedBannerIds.has(option.value.id) ? "text-gray-500" : ""}>
							{option.label}
							{alreadyPlannedBannerIds.has(option.value.id) && (
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
			</div>

			{/* === Start / End Date === */}
			<div className="w-32 shrink-0 flex flex-col items-start justify-center gap-0.5 py-2 px-2 text-xs text-gray-400 relative">
				<div className="absolute right-0 top-3 bottom-3 w-px bg-gray-700" />
				{bannerTimeline ? (
					<>
						<span>Start: <span className="text-white">{formatDate(bannerTimeline.start_date)}</span></span>
						<span>End: <span className="text-white">{formatDate(bannerTimeline.end_date)}</span></span>
					</>
				) : (
					<span className="text-gray-600">—</span>
				)}
			</div>

			{/* === Add to sheet button (replaces Derived Stats) === */}
			<div className="w-65 shrink-0 flex items-center justify-center px-3 py-2">
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
			<div className="w-22.5 shrink-0 flex items-center justify-center py-2 px-2 relative">
				<div className="absolute left-0 top-3 bottom-3 w-px bg-gray-700" />
				<div className="absolute right-0 top-3 bottom-3 w-px bg-gray-700" />
				<input
					type="number"
					value={stagedBanner.number_of_pulls}
					className="spin-arrows w-16 h-9 text-center text-sm border border-green-500 rounded bg-gray-700 text-green-400 focus:border-green-400 focus:outline-none pl-4.5"
					min={0}
					onChange={handlePullCountChange}
				/>
			</div>

			{/* === MLB chance grid === */}
			<div className="flex-1 flex items-center justify-center py-2 px-2 min-w-0">
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
	)
}
