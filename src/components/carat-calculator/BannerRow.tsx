import {
	differenceInDays,
	eachDayOfInterval,
	eachMonthOfInterval,
	format,
	getDay
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
import { useEffect, useMemo, useState } from "react"
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
}

export const BannerRow = ({
	plannedBanner,
	userStatsData,
	clubRankData,
	teamTrialsRankData,
	championsMeetingRankData,
	userPlannedBannerData,
	umaBannerData,
	supportBannerData,
	caratsAvailableForThisBanner,
	setUserPlannedBannerData
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
	const userClubRank = clubRankData.find(
		(rank) => rank.id === userStatsData.club_rank
	)
	const userTeamTrialsRank = teamTrialsRankData.find(
		(rank) => rank.id === userStatsData.team_trials_rank
	)
	const userChampionsMeetingRank = championsMeetingRankData.find(
		(rank) => rank.id === userStatsData.champions_meeting_rank
	)
	const dailyCaratPack = userStatsData.daily_carat ? 50 : 0
	const currentDate = new Date()
	const endDate = new Date(
		plannedBanner.banner_uma
			? plannedBanner.banner_uma.banner_timeline.end_date
			: plannedBanner.banner_support
			? plannedBanner.banner_support.banner_timeline.end_date
			: currentDate
	)

	const calculateDaysBetween = (start: Date, end: Date): number => {
		return differenceInDays(end, start)
	}
	const calculateMondaysBetween = (start: Date, end: Date): number => {
		const allDays = eachDayOfInterval({ start, end })
		return allDays.filter((day) => getDay(day) === 1).length
	}
	const calculateMonthlyOccurrences = (start: Date, end: Date): number => {
		const months = eachMonthOfInterval({ start, end })
		return months.length
	}

	const numberOfDays = calculateDaysBetween(currentDate, endDate)
	const numberOfMondays = calculateMondaysBetween(currentDate, endDate)
	const numberOfMonthlyOccurrences = calculateMonthlyOccurrences(
		currentDate,
		endDate
	)

	const totalIncome = useMemo(() => {
		return (
			dailyCaratPack * numberOfDays +
			(userClubRank?.income_amount || 0) * numberOfMonthlyOccurrences +
			(userTeamTrialsRank?.income_amount || 0) * numberOfMondays +
			(userChampionsMeetingRank?.income_amount || 0) *
				numberOfMonthlyOccurrences
		)
	}, [
		dailyCaratPack,
		numberOfDays,
		userClubRank,
		userTeamTrialsRank,
		userChampionsMeetingRank,
		numberOfMondays,
		numberOfMonthlyOccurrences
	])
	const totalCarats = caratsAvailableForThisBanner + totalIncome
	const maxPossiblePulls = Math.floor(totalCarats / 150)

	const handleDeleteBannerClick = () => {
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
		<div className="m-4 w-full bg-neutral-200 rounded-xl border border-gray-200 shadow-sm p-4">
			<div className="w-full flex flex-wrap p-4">
				<div className="w-full lg:w-1/3 flex flex-wrap">
					<div className="flex w-full">
						<div className="flex flex-col w-1/2 text-center justify-evenly">
							<h1 className="text-sm font-medium text-gray-700">
								Banner Type:
							</h1>
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
						<div className="flex flex-col w-1/2 text-center justify-evenly">
							<h1 className="text-sm font-medium text-gray-700">Pulls:</h1>
							<input
								type="number"
								value={plannedBanner.number_of_pulls}
								className="w-full text-center border border-[#cccccc] rounded h-9.5 bg-white"
								max={maxPossiblePulls}
								min={0}
								onChange={(e) => {
									const newPullCount = Number(e.target.value)

									const updatedUserPlannedBannerData =
										userPlannedBannerData?.map((mappedBannerData) => {
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
										})
									setUserPlannedBannerData(updatedUserPlannedBannerData)
								}}
							/>
						</div>
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
					</div>
				</div>

				<div className="w-full lg:w-1/3 flex flex-wrap">
					{(plannedBanner.banner_uma || plannedBanner.banner_support) && (
						<>
							<div className="flex w-full justify-center">
								<div className="flex flex-wrap p-1">
									<div className="text-center w-full text-sm font-medium text-gray-700">
										Start Date:
									</div>
									<div className="text-center w-full">
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
									<div className="text-center w-full">
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
							<div className="flex w-full justify-center">
								{plannedBanner.banner_uma
									? plannedBanner.banner_uma.umas.map((umas) => (
											<img key={umas.name} src={umas.image} alt={umas.name} />
									  ))
									: plannedBanner.banner_support
									? plannedBanner.banner_support.support_cards.map(
											(support_cards) => (
												<img
													key={support_cards.name}
													src={support_cards.image}
													alt={support_cards.name}
													className="p-1"
												/>
											)
									  )
									: ""}
							</div>
							<div className="flex w-full">
								<div className="w-1/2 text-center p-1 text-sm font-medium text-gray-700">
									Carat Estimation: {totalCarats}
								</div>
								<div className="w-1/2 text-center p-1 text-sm font-medium text-gray-700">
									Max Pulls: {maxPossiblePulls}
								</div>
							</div>
						</>
					)}
				</div>

				<div className="w-full lg:w-1/3">
					{/*All the percentage chances of getting the MLBs*/}
					{(plannedBanner.banner_uma || plannedBanner.banner_support) && (
						<MLBChanceDisplay pulls={plannedBanner.number_of_pulls} />
					)}
				</div>
			</div>
			<button
				onClick={handleDeleteBannerClick}
				className="w-full px-4 py-2 rounded-2xl bg-red-50 text-red-700 font-medium border border-red-200 hover:bg-red-100 hover:border-red-300 transition shadow-sm"
			>
				Delete Banner
			</button>
		</div>
	)
}
