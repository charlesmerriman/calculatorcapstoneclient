import {
	differenceInDays,
	eachDayOfInterval,
	eachMonthOfInterval,
	getDay
} from "date-fns"
import type {
	Banner,
	ChampionsMeetingRank,
	ClubRank,
	TeamTrailsRank,
	UserPlannedBanner,
	UserStats
} from "../../services/calculatorTypes"

type BannerRowProps = {
	plannedBanner: UserPlannedBanner
	bannerDetails: Banner | undefined
	userStatsData: UserStats
	clubRankData: ClubRank[]
	teamTrialsRankData: TeamTrailsRank[]
	championsMeetingRankData: ChampionsMeetingRank[]
	currentCarats: number
	setCurrentCarats: React.Dispatch<React.SetStateAction<number>>}

export const BannerRow = ({
	plannedBanner,
	bannerDetails,
	userStatsData,
    clubRankData,
	teamTrialsRankData,
	championsMeetingRankData,
	currentCarats,
	setCurrentCarats
}: BannerRowProps) => {
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
    const endDate = new Date(bannerDetails?end_date || currentDate)

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
    const numberOfMonthlyOccurrences = calculateMonthlyOccurrences(currentDate, endDate)


    const totalIncome = (dailyCaratPack * numberOfDays) + ((userClubRank?.income_amount || 0) * numberOfMonthlyOccurrences) + ((userTeamTrialsRank?.income_amount || 0 ) * numberOfMondays) + ((userChampionsMeetingRank?.income_amount || 0) * numberOfMonthlyOccurrences)
    const totalCarats = currentCarats + totalIncome
    const caratsSpent = plannedBanner.number_of_pulls * 150
    const remainingCarats = totalCarats - caratsSpent
    const maxPossiblePulls = Math.floor(totalCarats / 150)

	return (
        <div>
            {/*Banner Type Selector*/}
            {/*Banner Image*/}
            {/*Banner Selector*/}
            {/*Banner Start Date*/}
            {/*Banner End Date*/}
            {/*Carat estimation*/}
            {/*Max Amount of Pulls*/}
            {/*Number of Pulls Allocated*/}
            {/*All the percentage chances of getting the MLBs*/}
        </div>
    )
}

//TODO: Send remainingCarats back to parent component, add index
