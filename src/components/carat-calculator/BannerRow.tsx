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
import { darkTextStyles } from "../../utils/reactSelectStyles"

/**
 * TYPESCRIPT CONCEPT: Props Interfaces
 *
 * Always define a named interface for component props rather than inlining
 * the type in the function signature. This makes the props reusable,
 * documentable, and easier to read.
 *
 * Note: We import Dispatch and SetStateAction through React's namespace
 * below, but you could also import them directly from "react".
 */
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

/**
 * TYPESCRIPT CONCEPT: Typing react-select Options
 *
 * react-select is generic over its option type. When you define what an
 * "option" looks like, the onChange callback gets properly typed.
 * Without these, `selectedOption.value` would be `unknown` under strict mode.
 */
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
		} else if (bannerType === "Support") {
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

	/**
	 * TYPESCRIPT CONCEPT: Helper to Find and Update a Banner in the Array
	 *
	 * This helper centralizes the "find the matching banner" logic that was
	 * duplicated across multiple handlers. The `updater` callback receives
	 * the matched banner and returns a new one.
	 *
	 * The return type uses `UserPlannedBanner[]` explicitly — without it,
	 * TypeScript might infer a wider type from the .map() call.
	 */
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
		const confirmed = window.confirm(
			"Are you sure you want to delete this banner?"
		)
		if (!confirmed) return

		const updated = userPlannedBannerData.filter(
			(mappedBannerData) =>
				mappedBannerData.tempId
					? mappedBannerData.tempId !== plannedBanner.tempId
					: mappedBannerData.id !== plannedBanner.id
		)
		setUserPlannedBannerData(updated)
	}

	const handleBannerTypeChange = (option: SingleValue<BannerTypeOption>): void => {
		if (option) {
			setBannerType(option.value)
		}
	}

	const handleBannerSelect = (option: SingleValue<BannerOption>): void => {
		if (!option) return

		const updated = updateBannerInList((banner) => {
			if (bannerType === "Uma") {
				return {
					...banner,
					banner_uma: option.value as BannerUma,
					banner_support: undefined
				}
			}
			return {
				...banner,
				banner_uma: undefined,
				banner_support: option.value as BannerSupport
			}
		})

		/**
		 * TYPESCRIPT CONCEPT: Non-null Assertion Operator (!)
		 *
		 * The `!` after banner_support below tells TypeScript "I know this
		 * isn't null/undefined." Use sparingly — it bypasses null checking.
		 * Here it's safe because the sort only runs on banners that have
		 * either banner_uma or banner_support set (guaranteed by the UI flow).
		 *
		 * A safer alternative would be to provide a fallback:
		 *   a.banner_support?.banner_timeline.start_date ?? ""
		 */
		const sorted = updated.sort((a, b) => {
			const aDate = new Date(
				a.banner_uma
					? a.banner_uma.banner_timeline.start_date
					: a.banner_support!.banner_timeline.start_date
			)
			const bDate = new Date(
				b.banner_uma
					? b.banner_uma.banner_timeline.start_date
					: b.banner_support!.banner_timeline.start_date
			)
			return aDate.getTime() - bDate.getTime()
		})
		setUserPlannedBannerData(sorted)
	}

	/**
	 * TYPESCRIPT CONCEPT: React Event Types
	 *
	 * React provides generic event types like ChangeEvent<HTMLInputElement>.
	 * Under strict mode, the `e` parameter MUST be typed — implicit `any`
	 * is not allowed. The generic parameter tells TypeScript that
	 * `e.target` is specifically an HTMLInputElement (so `.value` exists).
	 */
	const handlePullCountChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
		const newPullCount = Number(e.target.value)
		const updated = updateBannerInList((banner) => ({
			...banner,
			number_of_pulls: newPullCount
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

	return (
		<div className="m-2 w-full flex flex-wrap lg:flex-nowrap">
			<div className="w-full flex flex-wrap bg-neutral-200 rounded-l-xl p-2 border border-gray-200 shadow-sm">
				<div className="w-full lg:w-1/3 flex flex-wrap border-0 rounded-2xl bg-gray-100 p-3 justify-center items-center">
					<div className="flex flex-col w-full text-center justify-evenly">
						<h1 className="text-sm font-medium text-gray-700">Banner Type:</h1>
						<Select<BannerTypeOption>
							styles={darkTextStyles}
							defaultValue={{
								value: bannerType,
								label: bannerType
							}}
							onChange={handleBannerTypeChange}
							options={[
								{ value: "Uma", label: "Uma" },
								{ value: "Support", label: "Support" }
							]}
						/>
					</div>
					<div className="text-center w-full flex flex-wrap justify-evenly">
						<h1 className="text-sm w-full font-medium text-gray-700">
							Target Banner:
						</h1>
						<Select<BannerOption>
							styles={darkTextStyles}
							className="w-full"
							defaultValue={{
								value: currentBanner as BannerUma | BannerSupport,
								label: currentBanner ? currentBanner.name : "Add a banner"
							}}
							onChange={handleBannerSelect}
							options={targetBannerData
								.filter(
									(banner) =>
										(bannerType === "Uma"
											? "umas" in banner
											: "support_cards" in banner) &&
										new Date(banner.banner_timeline.end_date) > currentDate
								)
								.map((banner) => ({
									value: banner,
									label: banner.name,
									key: banner.id
								}))}
						/>
					</div>{" "}
					<div className="flex w-full">
						<div className="w-1/3 text-center p-1">
							<div className="text-center w-full text-sm font-medium text-gray-700">
								Carat Estimation:
							</div>{" "}
							<div className="text-base font-medium">{displayCarats}</div>
						</div>
						<div className="w-1/3 text-center p-1">
							<div className="text-center w-full text-sm font-medium text-gray-700 ">
								Free Pulls:
							</div>{" "}
							<div className="text-base font-medium">
								{getFreePulls(plannedBanner)}
							</div>
						</div>
						<div className="w-1/3 text-center p-1">
							<div className="text-center w-full text-sm font-medium text-gray-700">
								Max Pulls:
							</div>{" "}
							<div className="text-base font-medium">{maxPossiblePulls}</div>
						</div>
					</div>
					<div className="flex flex-col w-full text-center justify-evenly">
						<h1 className="text-sm font-medium text-gray-700 text-center">
							Pulls:
						</h1>
						<input
							type="number"
							value={plannedBanner.number_of_pulls}
							className="w-full text-center border border-green-200 rounded h-9.5 bg-emerald-50 focus:border-green-400 focus:outline-none md:pl-4"
							max={maxPossiblePulls === "Passed" ? 0 : maxPossiblePulls}
							min={0}
							onChange={handlePullCountChange}
						/>
					</div>
				</div>

				<div className="w-full lg:w-1/3 flex flex-col justify-center items-center">
					{hasBanner && (
						<div className="flex flex-wrap border-0 rounded-2xl bg-gray-100 lg:ml-4 p-3 justify-center items-center ">
							<div className="flex w-full justify-center">
								<div className="flex flex-wrap p-1">
									<div className="text-center w-full text-sm font-medium text-gray-700">
										Start Date:
									</div>
									<div className="text-center w-full text-base font-medium">
										{bannerStartDate
											? format(new Date(bannerStartDate), "MMMM d, yyyy")
											: ""}
									</div>
								</div>
								<div className="flex flex-wrap p-1">
									<div className="text-center w-full text-sm font-medium text-gray-700">
										End Date:{" "}
									</div>
									<div className="text-center w-full text-base font-medium">
										{bannerEndDate
											? format(new Date(bannerEndDate), "MMMM d, yyyy")
											: ""}
									</div>
								</div>
							</div>
							<div className="flex flex-wrap">
								{plannedBanner.banner_uma
									? plannedBanner.banner_uma.umas.map((uma) => (
											<img
												key={uma.name}
												src={uma.image}
												alt={uma.name}
												className="h-auto w-auto max-h-40 object-contain flex-none"
											/>
									  ))
									: plannedBanner.banner_support
									? plannedBanner.banner_support.support_cards.map(
											(support_card) => (
												<img
													key={support_card.name}
													src={support_card.image}
													alt={support_card.name}
													className="h-auto w-auto max-h-40 object-contain flex-none"
												/>
											)
									  )
									: null}
							</div>
						</div>
					)}
				</div>

				<div className="w-full lg:w-1/3 lg:pl-1">
					{hasBanner && (
						<MLBChanceDisplay
							pulls={plannedBanner.number_of_pulls}
							plannedBanner={plannedBanner}
						/>
					)}
				</div>
			</div>
			<button
				onClick={handleDeleteBannerClick}
				className="w-full lg:w-auto pt-1 pb-1 lg:pl-1 lg:pr-1 rounded-b-xl lg:rounded-r-xl lg:rounded-l-none bg-red-50 border border-gray-300 text-red-900 font-medium hover:bg-red-200 transition text-xs"
			>
				Delete
			</button>
		</div>
	)
}