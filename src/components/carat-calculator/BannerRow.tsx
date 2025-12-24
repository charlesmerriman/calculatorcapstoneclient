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
	currentCarats: number
	bannerTypeData: BannerType[]
	userPlannedBannerData: UserPlannedBanner[] | null
	umaBannerData: Banner[]
	supportBannerData: Banner[]
	caratsAvailableForThisBanner: number
	setUserPlannedBannerData: React.Dispatch<
		React.SetStateAction<UserPlannedBanner[] | null>
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
	const [bannerType, setBannerType] = useState<BannerType | null>(
		bannerDetails.banner_type || null
	)
	const [targetBannerData, setTargetBannerData] = useState<Banner[] | null>(
		null
	)

	useEffect(() => {
		if (bannerType.id === 1) {
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

	return (
		<div className="m-4">
			<div>
				<h1>Type:</h1>
				<Select
					defaultValue={
						bannerType
							? {
									value: bannerType,
									label: bannerType.name,
									key: bannerType.id
							  }
							: null
					}
					onChange={(selectedOption) => {
						setBannerType(selectedOption ? selectedOption.value : null)
					}}
					options={bannerTypeData.map((type) => {
						return { value: type, label: type.name, key: type.id }
					})}
				/>
			</div>
			{/*Banner Image*/}
			<div>
				<h1>Target Banner:</h1>
				<Select
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
						const updatedUserPlannedBannerData = userPlannedBannerData?.map(
							(mappedBannerData) => {
								if (mappedBannerData.id === plannedBanner.id) {
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
			{
				<div>
					Start Date:
					{format(new Date(bannerDetails.start_date), "MMMM d, yyyy")}
				</div>
			}
			{
				<div>
					End Date: {format(new Date(bannerDetails.end_date), "MMMM d, yyyy")}
				</div>
			}
			{<div>Carat Estimation: {totalCarats}</div>}
			{<div>Max Pulls: {maxPossiblePulls}</div>}
			{
				<div>
					Pulls:
					<input
						type="number"
						value={plannedBanner.number_of_pulls}
						max={maxPossiblePulls}
						min={0}
						onChange={(e) => {
							const newPullCount = Number(e.target.value)

							const updatedUserPlannedBannerData = userPlannedBannerData?.map(
								(mappedBannerData) => {
									if (mappedBannerData.id === plannedBanner.id) {
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
			}
			{/*All the percentage chances of getting the MLBs*/}
		</div>
	)
}

//TODO: Send remainingCarats back to parent component, add index
