import type React from "react"
import { useCalculatorData } from "../../services/CalculatorContext"
import { BannerRow } from "./BannerRow"
import { IncomeForm } from "./IncomeForm"
import { useEffect, useMemo } from "react"
import { differenceInDays, eachDayOfInterval, eachMonthOfInterval, getDay } from "date-fns"

export const CaratCalculator: React.FC = () => {
	const {
		userStatsData,
		clubRankData,
		teamTrialsRankData,
		championsMeetingRankData,
		championsMeetingData,
		eventRewardsData,
		umaBannerData,
		supportBannerData,
		userPlannedBannerData,
		isDropdown,
		setUserPlannedBannerData,
		setIsDropdown,
	} = useCalculatorData()

	useEffect(() => {
		setIsDropdown(true)
	}, [setIsDropdown])

	const calculateDailyIncome = (start: Date, end: Date, referenceDate: Date): number => {
	let totalIncome = 0;
	const allDays = eachDayOfInterval({ start, end });
	
	allDays.forEach((day) => {
		totalIncome += 75
		
		const daysSinceReference = differenceInDays(day, referenceDate);
		
		if (daysSinceReference === 0) {
			totalIncome += 25
		} else if (daysSinceReference === 3) {
			totalIncome += 25
		} else if (daysSinceReference === 5) {
			totalIncome += 25
		} else if (daysSinceReference === 7) {
			totalIncome += 75
		}
	});
	
	return totalIncome;
};
	
	const calculateMondaysBetween = (start: Date, end: Date): number => {
			const allDays = eachDayOfInterval({ start, end })
			return allDays.filter((day) => getDay(day) === 1).length
		}
		const calculateMonthlyOccurrences = (start: Date, end: Date): number => {
			const months = eachMonthOfInterval({ start, end })
			return months.length
		}
	const bannerResources = useMemo(() => {
		// User's starting resources
		let carats = userStatsData?.current_carat || 0
		let umaTickets = userStatsData?.uma_ticket || 0
		let supportTickets = userStatsData?.support_ticket || 0

		// Storage for resources
		const results: {
			carats: number
			umaTickets: number
			supportTickets: number
		}[] = []

		const plannedBanner = [...userPlannedBannerData];
		
		// Current date
		let lastEndDate = new Date()

		for (const banner of plannedBanner) {
			const endDateStr =
				banner.banner_uma?.banner_timeline.end_date ??
				banner.banner_support?.banner_timeline.end_date
			if (!endDateStr) continue

			const endDate = new Date(endDateStr)

			const userChampionsMeetingRank = championsMeetingRankData.find(
				(rank) => rank.id === userStatsData.champions_meeting_rank
			)
			const userClubRank = clubRankData.find(
				(rank) => rank.id === userStatsData.club_rank
			)
			const userTeamTrialsRank = teamTrialsRankData.find(
				(rank) => rank.id === userStatsData.team_trials_rank
			)

			// Add ALL income types between lastEndDate and endDate (precise)
			// Events: filter last < date < end
			for (const ev of eventRewardsData) {
				const evDate = new Date(ev.date)
				if (evDate > lastEndDate && evDate <= endDate) {
					carats += ev.carat_amount
					umaTickets += ev.uma_ticket_amount
					supportTickets += ev.support_ticket_amount
				}
			}

			// Meetings: similar
			for (const meet of championsMeetingData) {
				const meetDate = new Date(meet.end_date)
				if (meetDate > lastEndDate && meetDate <= endDate) {
					carats += userChampionsMeetingRank?.income_amount ?? 0
				}
			}

			// Add regular: daily, club, trials (use date-fns to calc precisely since last)
			const days = differenceInDays(endDate, lastEndDate)
			const mondays = calculateMondaysBetween(lastEndDate, endDate);
    		const months = calculateMonthlyOccurrences(lastEndDate, endDate);
			const referenceDate = new Date()

			carats += userStatsData.daily_carat ? 50 * days : 0
			carats += (userClubRank?.income_amount ?? 0) * months
			carats += (userTeamTrialsRank?.income_amount ?? 0) * mondays
			carats += calculateDailyIncome(lastEndDate, endDate, referenceDate)

			// Record available BEFORE spend
			results.push({ carats, umaTickets: umaTickets, supportTickets: supportTickets })

			// Spend for this banner (subtract for next)
			const isUmaBanner = !!banner.banner_uma
			const freePulls =
				banner.banner_uma?.free_pulls ??
				banner.banner_support?.free_pulls ??
				0
			let normalPullsNeeded = Math.max(0, banner.number_of_pulls - freePulls);

			if (isUmaBanner) {
				const use = Math.min(normalPullsNeeded, umaTickets)
				umaTickets -= use
				normalPullsNeeded -= use

				const caratsToSpend = normalPullsNeeded * 150
				carats -= caratsToSpend
			} else {
				const use = Math.min(normalPullsNeeded, supportTickets)
				supportTickets -= use
				normalPullsNeeded -= use

				const caratsToSpend = normalPullsNeeded * 150
				carats -= caratsToSpend
			}
			

			if (endDate > lastEndDate) {
			lastEndDate = endDate
			}
		}
		return results
	}, [
		championsMeetingData,
		championsMeetingRankData,
		clubRankData,
		eventRewardsData,
		teamTrialsRankData,
		userPlannedBannerData,
		userStatsData
	])
	if (!userStatsData) {
		return <div>Loading...</div>
	}

	const handleAddBanner = () => {
		const arrayOfBannerIds = userPlannedBannerData.map(
			(banner) => (banner.tempId || banner.id)!
		)
		const highestId =
			arrayOfBannerIds.length > 0 ? Math.max(...arrayOfBannerIds) : 0

		const newPlannedBanner = {
			tempId: highestId + 1,
			number_of_pulls: 0
		}
		const plannedBannersArrayCopy = [...userPlannedBannerData]
		if (
			plannedBannersArrayCopy.every(
				(banner) => banner["banner_uma"] || banner["banner_support"]
			)
		) {
			plannedBannersArrayCopy.unshift(newPlannedBanner)
		}
		setUserPlannedBannerData(plannedBannersArrayCopy)
	}




	return (
		<div className="justify-center w-full min-h-screen bg-white lg:max-w-7xl mx-auto p-4">
				{isDropdown ? <IncomeForm /> : ""}

			<div className="flex m-4 flex-wrap">
				<div className="flex h-64 text-center justify-center items-center w-full">Extra Space</div>
				<button
					className="w-full px-4 py-2 rounded-xl bg-gray-100 border border-gray-300 text-gray-800 font-medium hover:bg-gray-200 transition "
					onClick={handleAddBanner}
				>
					Add Additional Banner
				</button>
				{userPlannedBannerData.map((plannedBanner, index) => {
					const resources = bannerResources[index] ?? {
						carats: 0,
						umaTickets: 0,
						supportTickets: 0,
					};

					return (
						<BannerRow
							key={plannedBanner.id || plannedBanner.tempId}
							plannedBanner={plannedBanner}
							userPlannedBannerData={userPlannedBannerData || []}
							clubRankData={clubRankData || []}
							teamTrialsRankData={teamTrialsRankData || []}
							championsMeetingRankData={championsMeetingRankData || []}
							userStatsData={userStatsData}
							umaBannerData={umaBannerData || []}
							supportBannerData={supportBannerData || []}
							setUserPlannedBannerData={setUserPlannedBannerData}
							caratsAvailableForThisBanner={resources.carats}
							umaTicketsAvailableForThisBanner={resources.umaTickets}
							supportTicketsAvailableForThisBanner={resources.supportTickets}
						/>
					)
				})}
			</div>
		</div>
	)
}
