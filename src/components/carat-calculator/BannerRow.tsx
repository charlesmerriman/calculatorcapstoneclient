import {
	format
} from "date-fns"
import type {
	ChampionsMeetingRank,
	ClubRank,
	TeamTrailsRank,
	UserPlannedBanner,
	UserStats,
	BannerUma,
	BannerSupport
} from "../../services/calculatorTypes"
import { useEffect, useState } from "react"
import Select from "react-select"
import { MLBChanceDisplay } from "./MLBChanceDisplay"

type BannerRowProps = {
	plannedBanner: UserPlannedBanner
	userStatsData: UserStats
	clubRankData: ClubRank[]
	teamTrialsRankData: TeamTrailsRank[]
	championsMeetingRankData: ChampionsMeetingRank[]
	userPlannedBannerData: UserPlannedBanner[] | []
	umaBannerData: BannerUma[]
	supportBannerData: BannerSupport[]
	caratsAvailableForThisBanner: number
	setUserPlannedBannerData: React.Dispatch<
		React.SetStateAction<UserPlannedBanner[] | []>
	>
	umaTicketsAvailableForThisBanner: number
	supportTicketsAvailableForThisBanner: number
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
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setTargetBannerData(umaBannerData)
		} else if (bannerType === "Support") {
			setTargetBannerData(supportBannerData)
		}
	}, [bannerType, supportBannerData, umaBannerData])

	const currentBanner = targetBannerData.find(
		(banner) =>
			banner.id === plannedBanner.banner_uma?.id ||
			banner.id === plannedBanner.banner_support?.id ||
			""
	)

	const currentDate = new Date()

	const calculateMaxPossiblePulls = () => {
	if (plannedBanner.banner_uma) {
		if (new Date(plannedBanner.banner_uma.banner_timeline.end_date).getTime() < currentDate.getTime()) {
			caratsAvailableForThisBanner = 0
			return "Passed"
		} else {
		return (
			plannedBanner.banner_uma.free_pulls +
			umaTicketsAvailableForThisBanner +
			Math.floor(caratsAvailableForThisBanner / 150)
		)}
	}

	if (plannedBanner.banner_support) {
		if (new Date(plannedBanner.banner_support.banner_timeline.end_date).getTime() < currentDate.getTime()) {
			caratsAvailableForThisBanner = 0
			return 0
		} else {
		return (
			plannedBanner.banner_support.free_pulls +
			supportTicketsAvailableForThisBanner +
			Math.floor(caratsAvailableForThisBanner / 150)
		)}
	}

	return 0
}

	const maxPossiblePulls = calculateMaxPossiblePulls()

	const handleDeleteBannerClick = () => {
		const confirmed = window.confirm("Are you sure you want to delete this banner?")

		if (!confirmed) {
			return 
		}

		const updatedUserPlannedBannerData = userPlannedBannerData?.filter(
			(mappedBannerData) =>
				mappedBannerData.tempId
					? mappedBannerData.tempId !== plannedBanner.tempId
					: mappedBannerData.id !== plannedBanner.id
		)
		setUserPlannedBannerData(updatedUserPlannedBannerData)
	}

	const customStyles = {
		option: (provided) => ({
			...provided,
			color: "#000"
		})
	}

	return (
		<div className="m-2 w-full flex flex-wrap lg:flex-nowrap">
			<div className="w-full flex flex-wrap bg-neutral-200 rounded-l-xl p-2 border border-gray-200 shadow-sm">
				<div className="w-full lg:w-1/3 flex flex-wrap border-0 rounded-2xl bg-white p-3 justify-center items-center">
					<div className="flex flex-col w-full text-center justify-evenly">
						<h1 className="text-sm font-medium text-gray-700">Banner Type:</h1>
						<Select
							styles={customStyles}
							defaultValue={{
								value: bannerType,
								label: bannerType
							}}
							onChange={(selectedOption) => {
								if (selectedOption) {
									setBannerType(selectedOption.value)
								}
							}}
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
						<Select
							styles={customStyles}
							className="w-full"
							defaultValue={{
								value: currentBanner,
								label: currentBanner ? currentBanner.name : "Add a banner"
							}}
							onChange={(selectedOption) => {
								const updatedUserPlannedBannerData = userPlannedBannerData.map(
									(mappedBannerData) => {
										if (
											(mappedBannerData.id &&
												mappedBannerData.id === plannedBanner.id) ||
											(mappedBannerData.tempId &&
												mappedBannerData.tempId === plannedBanner.tempId)
										) {
											if (selectedOption && bannerType === "Uma") {
												return {
													...mappedBannerData,
													banner_uma: selectedOption.value,
													banner_support: undefined
												}
											} else if (selectedOption && bannerType === "Support") {
												return {
													...mappedBannerData,
													banner_uma: undefined,
													banner_support: selectedOption.value
												}
											}
										}
										return mappedBannerData
									}
								) as UserPlannedBanner[]
								const sorted = updatedUserPlannedBannerData.sort((a, b) => {
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
							}}
							options={targetBannerData
								.filter((banner) =>
									bannerType === "Uma"
										? "umas" in banner
										: "support_cards" in banner
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
							<div className="text-base font-medium">{caratsAvailableForThisBanner}</div>
						</div>
						<div className="w-1/3 text-center p-1">
							<div className="text-center w-full text-sm font-medium text-gray-700 ">
								Free Pulls:
							</div>{" "}
							<div className="text-base font-medium">{plannedBanner.banner_support ? plannedBanner.banner_support.free_pulls : plannedBanner.banner_uma ? plannedBanner.banner_uma.free_pulls : ""}</div>
						</div>
						<div className="w-1/3 text-center p-1">
							<div className="text-center w-full text-sm font-medium text-gray-700">
								Max Pulls:
							</div>{" "}
							<div className="text-base font-medium">{maxPossiblePulls}</div>
						</div>
					</div>
					<div className="flex flex-col w-full text-center justify-evenly">
						<h1 className="text-sm font-medium text-gray-700 text-center">Pulls:</h1>
						<input
							type="number"
							value={plannedBanner.number_of_pulls}
							className="w-full text-center border border-green-200 rounded h-9.5 bg-emerald-50 focus:border-green-400 focus:outline-none pl-4"
							max={maxPossiblePulls}
							min={0}
							onChange={(e) => {
								const newPullCount = Number(e.target.value)

								const updatedUserPlannedBannerData = userPlannedBannerData?.map(
									(mappedBannerData) => {
										if (
											(mappedBannerData.id &&
												mappedBannerData.id === plannedBanner.id) ||
											(mappedBannerData.tempId &&
												mappedBannerData.tempId === plannedBanner.tempId)
										) {
											return {
												...mappedBannerData,
												number_of_pulls: newPullCount
											}
										}
										return mappedBannerData
									}
								)
								setUserPlannedBannerData(updatedUserPlannedBannerData)
							}}
						/>
					</div>
				</div>

				<div className="w-full lg:w-1/3 flex justify-center items-center">

					{(plannedBanner.banner_uma || plannedBanner.banner_support) && (
						<div className="flex flex-wrap border-0 rounded-2xl bg-white ml-4 p-3 justify-center items-center">
							<div className="flex w-full justify-center">
								<div className="flex flex-wrap p-1">
									<div className="text-center w-full text-sm font-medium text-gray-700">
										Start Date:
									</div>
									<div className="text-center w-full text-base font-medium">
										{plannedBanner.banner_uma || plannedBanner.banner_support
											? format(
													new Date(
														plannedBanner.banner_uma
															? plannedBanner.banner_uma.banner_timeline
																	.start_date
															: plannedBanner.banner_support.banner_timeline
																	.start_date
													),
													"MMMM d, yyyy"
											  )
											: ""}
									</div>
								</div>
								<div className="flex flex-wrap p-1">
									<div className="text-center w-full text-sm font-medium text-gray-700">
										End Date:{" "}
									</div>
									<div className="text-center w-full text-base font-medium">
										{plannedBanner.banner_uma || plannedBanner.banner_support
											? format(
													new Date(
														plannedBanner.banner_uma
															? plannedBanner.banner_uma.banner_timeline
																	.end_date
															: plannedBanner.banner_support.banner_timeline
																	.end_date
													),
													"MMMM d, yyyy"
											  )
											: ""}
									</div>
								</div>
							</div>
							<div className="flex flex-wrap">
								{plannedBanner.banner_uma
									? plannedBanner.banner_uma.umas.map((umas) => (
											<img key={umas.name} src={umas.image} alt={umas.name} className="h-auto w-auto max-h-40 object-contain flex-none"/>
									  ))
									: plannedBanner.banner_support
									? plannedBanner.banner_support.support_cards.map(
											(support_cards) => (
												<img
													key={support_cards.name}
													src={support_cards.image}
													alt={support_cards.name}
													className="h-auto w-auto max-h-40 object-contain flex-none"
												
												/>
											)
									  )
									: ""}
							</div>
						</div>
					)}
				</div>

				<div className="w-full lg:w-1/3 pl-1">
					{/*All the percentage chances of getting the MLBs*/}
					{(plannedBanner.banner_uma || plannedBanner.banner_support) && (
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
