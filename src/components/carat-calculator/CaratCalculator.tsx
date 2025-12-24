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
		currentCarats,
		bannerTypeData,
		setUserPlannedBannerData
	} = useCalculatorData()

	if (!userStatsData) {
		return <div>Loading...</div>
	}

	const sortedBanners = (userPlannedBannerData || []).sort((a, b) => {
		const bannerA = [...umaBannerData, ...supportBannerData].find(
			(banner) => banner.id === a.banner
		)
		const bannerB = [...umaBannerData, ...supportBannerData].find(
			(banner) => banner.id === b.banner
		)

		return new Date(bannerA.start_date) - new Date(bannerB.start_date)
	})

	return (
		<>
			<IncomeForm />
			<div className="flex border m-4">
				{sortedBanners.map((plannedBanner, index) => {
					const bannerDetails = [
						...(umaBannerData || []),
						...(supportBannerData || [])
					].find((banner) => banner.id === plannedBanner.banner)

					const spentOnPrevious =
						sortedBanners
							.slice(0, index)
							.reduce((total, banner) => total + banner.number_of_pulls, 0) *
						150

					const caratsAvailableForThisBanner = currentCarats - spentOnPrevious

					if (!bannerDetails) {
						return null
					}

					return (
						<BannerRow
							key={plannedBanner.id}
							plannedBanner={plannedBanner}
							bannerDetails={bannerDetails}
							userPlannedBannerData={userPlannedBannerData || []}
							clubRankData={clubRankData || []}
							teamTrialsRankData={teamTrialsRankData || []}
							championsMeetingRankData={championsMeetingRankData || []}
							userStatsData={userStatsData}
							currentCarats={currentCarats}
							bannerTypeData={bannerTypeData || []}
							umaBannerData={umaBannerData || []}
							supportBannerData={supportBannerData || []}
							setUserPlannedBannerData={setUserPlannedBannerData}
							caratsAvailableForThisBanner={caratsAvailableForThisBanner}
						/>
					)
				})}
			</div>
		</>
	)
}
