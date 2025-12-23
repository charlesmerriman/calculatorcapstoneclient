import type React from "react"
import { useCalculatorData } from "../../services/CalculatorContext"
import { BannerRow } from "./BannerRow"

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
		setCurrentCarats
	} = useCalculatorData()

	if (!userStatsData) {
		return <div>Loading...</div>
	}

	return (
		<div>
			{(userPlannedBannerData || []).map((plannedBanner) => {
				const bannerDetails = [
					...(umaBannerData || []),
					...(supportBannerData || [])
				].find((banner) => banner.id === plannedBanner.banner)

				return (
					<BannerRow
						key={plannedBanner.id}
						plannedBanner={plannedBanner}
						bannerDetails={bannerDetails}
						clubRankData={clubRankData || []}
						teamTrialsRankData={teamTrialsRankData || []}
						championsMeetingRankData={championsMeetingRankData || []}
						userStatsData={userStatsData}
						currentCarats={currentCarats}
						setCurrentCarats={setCurrentCarats}
					/>
				)
			})}
		</div>
	)
}
