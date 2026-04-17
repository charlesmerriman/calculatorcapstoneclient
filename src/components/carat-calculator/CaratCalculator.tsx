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

		/**
		 * TYPESCRIPT CONCEPT: Satisfying Union Types
		 *
		 * We use `satisfies UserPlannedBanner` to verify this object matches
		 * one of the union's variants at the point of creation.
		 * `satisfies` checks the type WITHOUT widening it — the variable
		 * keeps its narrow literal type while still being validated.
		 *
		 * Alternatively, you could annotate: `const newBanner: LocalPlannedBanner = { ... }`
		 */
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
		<div className="justify-center w-full min-h-screen bg-white lg:max-w-7xl mx-auto p-4">
			{isDropdown ? <IncomeForm /> : null}

			<div className="flex m-4 flex-col items-center gap-2">
				<div className="flex text-center justify-center items-center">
				</div>
				<button
					className="w-full py-2 rounded-xl bg-gray-100 border border-gray-300 text-gray-800 font-medium hover:bg-gray-200 transition mt-2"
					onClick={handleAddBanner}
				>
					Add Additional Banner
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