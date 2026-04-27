import type React from "react"
import { useCalculatorData } from "../../services/CalculatorContext"
import { BannerRow } from "./BannerRow"
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
		setUserPlannedBannerData,
	} = useCalculatorData()

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

	const handleAddBanner = (bannerType: "Uma" | "Support"): void => {
		const arrayOfBannerIds = userPlannedBannerData.map(
			(banner) => banner.tempId ?? banner.id ?? 0
		)
		const highestId =
			arrayOfBannerIds.length > 0 ? Math.max(...arrayOfBannerIds) : 0

		const newPlannedBanner = {
			tempId: highestId + 1,
			number_of_pulls: 0,
			initialBannerType: bannerType
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
			<div className="flex mx-4 flex-col items-center gap-1.5">
				<div className="w-full border border-gray-600 rounded-lg shadow-sm overflow-hidden mt-2 pb-4">
					<div className="flex w-full border-b border-gray-700 border-b-0 py-4 gap-4 px-4">
						<button
							className="flex-1 py-2.5 rounded-lg bg-brand text-black font-medium hover:bg-brand/90 transition"
							onClick={() => handleAddBanner("Uma")}
						>
							⊕ Add Uma Banner
						</button>
						<div className="w-px bg-gray-700 self-stretch" />
						<button
							className="flex-1 py-2.5 rounded-lg border border-brand text-brand bg-transparent font-medium hover:bg-brand/10 transition"
							onClick={() => handleAddBanner("Support")}
						>
							⊕ Add Support Banner
						</button>
					</div>

					{userPlannedBannerData.length > 0 && (
						<div className="mx-4">
							<div className="flex w-full items-center text-xs text-gray-400 font-medium bg-gray-800 border-b border-gray-700 rounded-t-lg py-1.5">
								<div className="w-17.5 shrink-0 text-center">Type</div>
								<div className="w-36 shrink-0 text-center">Images</div>
								<div className="w-44 shrink-0 text-center">Banner</div>
								<div className="w-32 shrink-0 text-center">Start / End Date</div>
								<div className="w-65 shrink-0 text-center">Derived Stats (Auto-Calculated)</div>
								<div className="w-22.5 shrink-0 text-center"># Pulls</div>
								<div className="flex-1 text-center">% Chance to MLB (5x Copies)</div>
								<div className="w-10 shrink-0 text-center"></div>
							</div>
							<div className="divide-y divide-gray-700">
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
											initialBannerType={plannedBanner.initialBannerType}
										/>
									)
								})}
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}