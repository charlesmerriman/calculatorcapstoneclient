import type React from "react"
import { useCalculatorData } from "../../services/CalculatorContext"
import { BannerRow } from "./BannerRow"
import { IncomeForm } from "./IncomeForm"

export const CaratCalculator: React.FC = () => {
	const {
		userStatsData,
		clubRankData,
		teamTrialsRankData,
		championsMeetingRankData,
		umaBannerData,
		supportBannerData,
		userPlannedBannerData,
		setUserPlannedBannerData
	} = useCalculatorData()

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
			name: "Pick a banner",
			number_of_pulls: 0
		}
		const plannedBannersArrayCopy = [...userPlannedBannerData]
		if (
			plannedBannersArrayCopy.every(
				(banner) => banner["name"] != "Pick a banner"
			)
		) {
			plannedBannersArrayCopy.push(newPlannedBanner)
		}
		setUserPlannedBannerData(plannedBannersArrayCopy)
	}

	return (
		<div className="justify-center w-full min-h-screen bg-white lg:max-w-7xl mx-auto p-4">
			<IncomeForm />
			<div className="flex m-4 flex-wrap">
				{userPlannedBannerData.map((plannedBanner, index) => {
					const spentOnPrevious =
						userPlannedBannerData
							.slice(0, index)
							.reduce((total, banner) => total + banner.number_of_pulls, 0) *
						150

					const caratsAvailableForThisBanner =
						userStatsData.current_carat - spentOnPrevious

					if (!plannedBanner) {
						return null
					}

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
							caratsAvailableForThisBanner={caratsAvailableForThisBanner}
						/>
					)
				})}
			</div>{" "}
			<button
				className="w-full px-4 py-2 rounded-xl bg-gray-100 border border-gray-300 text-gray-800 font-medium hover:bg-gray-200 transition "
				onClick={handleAddBanner}
			>
				Add Additional Banner
			</button>
		</div>
	)
}
