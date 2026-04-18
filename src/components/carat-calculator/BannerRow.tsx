import { format } from "date-fns"
import type {
	ChampionsMeetingRank,
	ClubRank,
	TeamTrialsRank,
	UserPlannedBanner,
	UserStats,
	BannerUma,
	BannerSupport
} from "../../types"
import { useEffect, useState } from "react"
import Select from "react-select"
import type { SingleValue } from "react-select"
import { MLBChanceDisplay } from "./MLBChanceDisplay"
import { calculateMaxPossiblePulls, getFreePulls } from "../../utils/bannerHelpers"
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
	setUserPlannedBannerData: React.Dispatch<
		React.SetStateAction<UserPlannedBanner[]>
	>
	umaTicketsAvailableForThisBanner: number
	supportTicketsAvailableForThisBanner: number
}

interface BannerTypeOption {
	value: string
	label: string
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
	setUserPlannedBannerData,
	umaTicketsAvailableForThisBanner,
	supportTicketsAvailableForThisBanner
}: BannerRowProps) => {
	const [bannerType, setBannerType] = useState(
		plannedBanner.banner_support ? "Support" : "Uma"
	)
	const [targetBannerData, setTargetBannerData] = useState<
		BannerUma[] | BannerSupport[]
	>(plannedBanner.banner_support ? supportBannerData : umaBannerData)

	useEffect(() => {
		if (bannerType === "Uma") {
			setTargetBannerData(umaBannerData)
		} else {
			setTargetBannerData(supportBannerData)
		}
	}, [bannerType, supportBannerData, umaBannerData])

	const currentBanner = targetBannerData.find(
		(banner) =>
			banner.id === plannedBanner.banner_uma?.id ||
			banner.id === plannedBanner.banner_support?.id
	)

	const currentDate = new Date()

	const maxPossiblePulls = calculateMaxPossiblePulls({
		plannedBanner,
		caratsAvailable: caratsAvailableForThisBanner,
		umaTicketsAvailable: umaTicketsAvailableForThisBanner,
		supportTicketsAvailable: supportTicketsAvailableForThisBanner
	})

	const displayCarats =
		maxPossiblePulls === "Passed" ? 0 : caratsAvailableForThisBanner

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

	const handleBannerTypeChange = (option: SingleValue<BannerTypeOption>): void => {
		if (option) setBannerType(option.value)
	}

	const handleBannerSelect = (option: SingleValue<BannerOption>): void => {
		if (!option) return
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
		const updated = updateBannerInList((banner) => ({
			...banner,
			number_of_pulls: Number(e.target.value)
		}))
		setUserPlannedBannerData(updated)
	}

	const hasBanner = plannedBanner.banner_uma || plannedBanner.banner_support

	const bannerStartDate = plannedBanner.banner_uma
		? plannedBanner.banner_uma.banner_timeline.start_date
		: plannedBanner.banner_support?.banner_timeline.start_date

	const bannerEndDate = plannedBanner.banner_uma
		? plannedBanner.banner_uma.banner_timeline.end_date
		: plannedBanner.banner_support?.banner_timeline.end_date

	const freePulls = getFreePulls(plannedBanner)

	const images = plannedBanner.banner_uma
		? plannedBanner.banner_uma.umas
		: plannedBanner.banner_support
		? plannedBanner.banner_support.support_cards
		: []

	return (
		<div className="w-full flex border border-gray-200 rounded-lg overflow-hidden shadow-sm">
			{/* === Type Tab (vertical text on left edge) === */}
			<div
				className={`banner-type-tab ${
					bannerType === "Uma" ? "banner-type-tab--uma" : "banner-type-tab--support"
				}`}
			>
				{bannerType}
			</div>

			{/* === Left section: stats + selector === */}
			<div className="flex flex-col justify-center gap-1 p-2 min-w-0 flex-1">
				{/* Stats row */}
				<div className="flex items-end gap-3 flex-wrap">
					{hasBanner && bannerStartDate && (
						<div>
							<div className="banner-stat-label">Start Date</div>
							<div className="banner-stat-value">
								{format(new Date(bannerStartDate), "MMM d, yyyy")}
							</div>
						</div>
					)}
					{hasBanner && bannerEndDate && (
						<div>
							<div className="banner-stat-label">End Date</div>
							<div className="banner-stat-value">
								{format(new Date(bannerEndDate), "MMM d, yyyy")}
							</div>
						</div>
					)}
					<div>
						<div className="banner-stat-label">Carat Est.</div>
						<div className="banner-stat-value">{displayCarats.toLocaleString()}</div>
					</div>
					<div>
						<div className="banner-stat-label">Free Pulls</div>
						<div className="banner-stat-value">{freePulls}</div>
					</div>
					<div>
						<div className="banner-stat-label">Max Pulls</div>
						<div className="banner-stat-value">{maxPossiblePulls}</div>
					</div>
				</div>

				{/* Selector row */}
				<div className="flex items-center gap-2">
					<div className="w-24 shrink-0">
						<Select<BannerTypeOption>
							styles={compactSelectStyles}
							value={{ value: bannerType, label: bannerType }}
							onChange={handleBannerTypeChange}
							options={[
								{ value: "Uma", label: "Uma" },
								{ value: "Support", label: "Support" }
							]}
						/>
					</div>
					<div className="flex-1 min-w-40 max-w-60">
						<Select<BannerOption>
							styles={compactSelectStyles}
							placeholder={`Target ${bannerType} Banner`}
							value={
								currentBanner
									? { value: currentBanner as BannerUma | BannerSupport, label: currentBanner.name, key: currentBanner.id }
									: null
							}
							onChange={handleBannerSelect}
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
					<div className="flex items-center gap-1 shrink-0">
						<span className="text-[10px] font-medium text-gray-500"># Pulls</span>
						<input
							type="number"
							value={plannedBanner.number_of_pulls}
							className="w-16 h-7 text-center text-xs border border-green-200 rounded bg-emerald-50 focus:border-green-400 focus:outline-none"
							max={maxPossiblePulls === "Passed" ? 0 : maxPossiblePulls}
							min={0}
							onChange={handlePullCountChange}
						/>
					</div>
				</div>
			</div>

			{/* === Middle section: thumbnails === */}
			{images.length > 0 && (
				<div className="flex items-center gap-1 px-2 shrink-0">
					{images.map((img) => (
						<img
							key={img.name}
							src={img.image}
							alt={img.name}
							className="thumb-banner rounded"
						/>
					))}
				</div>
			)}

			{/* === Right section: MLB chance grid (fixed width) === */}
			{hasBanner && (
				<div className="w-72 shrink-0 flex items-center p-2">
					<MLBChanceDisplay
						pulls={plannedBanner.number_of_pulls}
						plannedBanner={plannedBanner}
					/>
				</div>
			)}

			{/* === Delete button (right edge) === */}
			<button onClick={handleDeleteBannerClick} className="banner-delete-btn">
				Delete
			</button>
		</div>
	)
}