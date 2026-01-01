import {
	differenceInDays,
	eachDayOfInterval,
	eachMonthOfInterval,
	format,
	getDay
} from "date-fns"
import type {
	Banner,
	BannerType,
	ChampionsMeetingRank,
	ClubRank,
	TeamTrailsRank,
	UserPlannedBanner,
	UserStats
} from "../../services/calculatorTypes"
import { useEffect, useMemo, useState } from "react"
import Select from "react-select"

type BannerRowProps = {
	plannedBanner: UserPlannedBanner
	bannerDetails: Banner
	userStatsData: UserStats
	clubRankData: ClubRank[]
	teamTrialsRankData: TeamTrailsRank[]
	championsMeetingRankData: ChampionsMeetingRank[]
	bannerTypeData: BannerType[]
	userPlannedBannerData: UserPlannedBanner[] | []
	umaBannerData: Banner[]
	supportBannerData: Banner[]
	caratsAvailableForThisBanner: number
	setUserPlannedBannerData: React.Dispatch<
		React.SetStateAction<UserPlannedBanner[] | []>
	>
}

export const BannerRow = ({
	plannedBanner,
	bannerDetails,
	userStatsData,
	clubRankData,
	teamTrialsRankData,
	championsMeetingRankData,
	bannerTypeData,
	userPlannedBannerData,
	umaBannerData,
	supportBannerData,
	caratsAvailableForThisBanner,
	setUserPlannedBannerData
}: BannerRowProps) => {
	const [bannerType, setBannerType] = useState<BannerType>(
		bannerDetails.banner_type
	)
	const [targetBannerData, setTargetBannerData] = useState<Banner[] | null>(
		null
	)

	useEffect(() => {
		if (bannerType.id === 1) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setTargetBannerData(umaBannerData)
		} else if (bannerType.id === 2) {
			setTargetBannerData(supportBannerData)
		}
	}, [bannerType, supportBannerData, umaBannerData])

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
	const endDate = new Date(bannerDetails?.end_date || currentDate)

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
		<div className="m-4 w-full">
			<div className="w-full border flex flex-wrap p-4">
				<div className="w-full lg:w-1/3 flex flex-wrap">
					<div className="flex w-full">
						<div className="flex flex-col w-1/2 text-center justify-evenly">
							<h1>Banner Type:</h1>
							<Select
								styles={customStyles}
								defaultValue={{
									value: bannerType,
									label: bannerType.name,
									key: bannerType.id
								}}
								onChange={(selectedOption) => {
									if (selectedOption) {
										setBannerType(selectedOption.value)
									}
								}}
								options={bannerTypeData.map((type) => {
									return { value: type, label: type.name, key: type.id }
								})}
							/>
						</div>
						<div className="flex flex-col w-1/2 text-center justify-evenly">
							Pulls:
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
											if (mappedBannerData.id === plannedBanner.id) {
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
					<div className="text-center w-full">
						<h1>Target Banner:</h1>
						<Select
							styles={customStyles}
							defaultValue={
								bannerDetails
									? {
											value: bannerDetails,
											label: bannerDetails.name,
											key: bannerDetails.id
									  }
									: null
							}
							onChange={(selectedOption) => {
								const updatedUserPlannedBannerData = userPlannedBannerData.map(
									(mappedBannerData) => {
										if (
											mappedBannerData.id === plannedBanner.id &&
											selectedOption
										) {
											return {
												...mappedBannerData,
												banner: selectedOption.value.id
											}
										}
										return mappedBannerData
									}
								)
								setUserPlannedBannerData(updatedUserPlannedBannerData)
							}}
							options={targetBannerData?.map((banner) => {
								return { value: banner, label: banner.name, key: banner.id }
							})}
						/>
					</div>
				</div>

				<div className="w-full lg:w-1/3 flex flex-wrap">
					<div className="flex w-full justify-center">
						<div className="flex flex-wrap">
							<div className="text-center w-full">Start Date:</div>
							<div className="text-center w-full">
								{format(new Date(bannerDetails.start_date), "MMMM d, yyyy")}
							</div>
						</div>
						<div className="flex flex-wrap">
							<div className="text-center w-full">End Date: </div>
							<div className="text-center w-full">
								{format(new Date(bannerDetails.end_date), "MMMM d, yyyy")}
							</div>
						</div>
					</div>
					<div className="flex w-full justify-center">
						<img src={bannerDetails.image} alt={bannerDetails.name} />
					</div>
					<div className="flex w-full">
						<div className="w-1/2 text-center">
							Carat Estimation: {totalCarats}
						</div>
						<div className="w-1/2 text-center">
							Max Pulls: {maxPossiblePulls}
						</div>
					</div>
				</div>

				<div className="lg:w-1/3">
					{/*All the percentage chances of getting the MLBs*/}
				</div>
			</div>
			<button onClick={handleDeleteBannerClick} className="btn w-full">
				Delete Banner
			</button>
		</div>
	)
}
