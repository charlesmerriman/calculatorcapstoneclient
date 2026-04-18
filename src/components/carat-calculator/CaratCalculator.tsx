import type React from "react"
import { useCalculatorData } from "../../services/CalculatorContext"
import { BannerRow } from "./BannerRow"
import { IncomeForm } from "./IncomeForm"
import { useEffect } from "react"
import { useBannerResources } from "../../hooks/useBannerResources"
import type { UserPlannedBanner } from "../../types"

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
		setIsDropdown
	} = useCalculatorData()

	useEffect(() => {
		setIsDropdown(true)
	}, [setIsDropdown])

	const bannerResources = useBannerResources({
		userStatsData,
		clubRankData,
		teamTrialsRankData,
		championsMeetingRankData,
		eventRewardsData,
		championsMeetingData,
		userPlannedBannerData
	})

	if (!userStatsData) {
		return <div>Loading...</div>
	}

	const handleAddBanner = (): void => {
		const arrayOfBannerIds = userPlannedBannerData.map(
			(banner) => banner.tempId ?? banner.id ?? 0
		)
		const highestId =
			arrayOfBannerIds.length > 0 ? Math.max(...arrayOfBannerIds) : 0

		const newPlannedBanner = {
			tempId: highestId + 1,
			number_of_pulls: 0
		} satisfies UserPlannedBanner

		const plannedBannersArrayCopy = [...userPlannedBannerData]
		if (
			plannedBannersArrayCopy.every(
				(banner) => banner.banner_uma || banner.banner_support
			)
		) {
			plannedBannersArrayCopy.unshift(newPlannedBanner)
		}
		setUserPlannedBannerData(plannedBannersArrayCopy)
	}

	return (
		<div className="page-container">
			{isDropdown ? <IncomeForm /> : null}

			<div className="flex m-4 flex-col items-center gap-1.5">
				<button
					className="w-full py-2 rounded-xl bg-gray-100 border border-gray-300 text-gray-800 font-medium hover:bg-gray-200 transition mt-2"
					onClick={handleAddBanner}
				>
					Add Banner
				</button>
				{userPlannedBannerData.map((plannedBanner, index) => {
					const resources = bannerResources[index] ?? {
						carats: 0,
						umaTickets: 0,
						supportTickets: 0
					}

					return (
						<BannerRow
							key={plannedBanner.id ?? plannedBanner.tempId}
							plannedBanner={plannedBanner}
							userPlannedBannerData={userPlannedBannerData}
							clubRankData={clubRankData}
							teamTrialsRankData={teamTrialsRankData}
							championsMeetingRankData={championsMeetingRankData}
							userStatsData={userStatsData}
							umaBannerData={umaBannerData}
							supportBannerData={supportBannerData}
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