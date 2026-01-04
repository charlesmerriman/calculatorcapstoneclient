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
		plannedBannersArrayCopy.push(newPlannedBanner)
		setUserPlannedBannerData(plannedBannersArrayCopy)
	}

	return (
		<div className="w-full lg:max-w-7xl mx-auto border p-4 bg-neutral-100">
			<IncomeForm />
			<button className="btn w-full" onClick={handleAddBanner}>
				Add Additional Banner
			</button>
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
			</div>
		</div>
	)
}
