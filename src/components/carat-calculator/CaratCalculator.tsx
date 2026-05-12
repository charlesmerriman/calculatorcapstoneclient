import type React from "react"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"
import { useCalculatorData } from "../../services/CalculatorContext"
import { BannerRow } from "./BannerRow"
import { StagedBannerRow } from "./StagedBannerRow"
import { useBannerResources } from "../../hooks/useBannerResources"
import type { UserPlannedBanner } from "../../types"

export const CaratCalculator: React.FC = () => {
	const {
		userStatsData,
		clubRankData,
		teamTrialsRankData,
		championsMeetingRankData,
		leagueOfHeroesRankData,
		championsMeetingData,
		leagueOfHeroesData,
		eventRewardsData,
		umaBannerData,
		supportBannerData,
		userPlannedBannerData,
		stagedBanner,
		setUserPlannedBannerData,
		setStagedBanner,
	} = useCalculatorData()

	const bannerResources = useBannerResources({
		userStatsData,
		clubRankData,
		teamTrialsRankData,
		championsMeetingRankData,
		leagueOfHeroesRankData,
		eventRewardsData,
		championsMeetingData,
		leagueOfHeroesData,
		userPlannedBannerData
	})

	if (!userStatsData) {
		return <div>Loading...</div>
	}

	const handleAddBanner = (bannerType: "Uma" | "Support"): void => {
		// Block adding a second staged banner of the same type.
		// Adding the opposite type is fine — it silently replaces the staged banner
		// (same behaviour as the old blank-banner replacement in the confirmed list).
		if (stagedBanner && stagedBanner.initialBannerType === bannerType) {
			toast.error(`A ${bannerType} banner is already staged. Select a banner for it or discard it first.`)
			return
		}

		// Generate a tempId higher than every existing id, including the current
		// staged banner's id, so there are never two banners sharing a tempId.
		const allIds = [
			...userPlannedBannerData.map((b) => b.tempId ?? b.id ?? 0),
			stagedBanner ? (stagedBanner.tempId ?? 0) : 0
		]
		const highestId = allIds.length > 0 ? Math.max(...allIds) : 0

		setStagedBanner({
			tempId: highestId + 1,
			number_of_pulls: 0,
			initialBannerType: bannerType
		} satisfies UserPlannedBanner)
	}

	const handleConfirmStagedBanner = (): void => {
		if (!stagedBanner) return
		if (!stagedBanner.banner_uma && !stagedBanner.banner_support) {
			toast.error("Please select a banner before adding it to the sheet.")
			return
		}
		const stagedId = stagedBanner.banner_uma?.id ?? stagedBanner.banner_support?.id
		const isDuplicate = userPlannedBannerData.some(
			(b) => (b.banner_uma?.id ?? b.banner_support?.id) === stagedId
		)
		if (isDuplicate) {
			toast.error("This banner is already on your sheet.")
			return
		}

		const updated = [...userPlannedBannerData, stagedBanner].sort((a, b) => {
			const aDate = new Date(
				a.banner_uma?.banner_timeline.start_date ?? a.banner_support!.banner_timeline.start_date
			)
			const bDate = new Date(
				b.banner_uma?.banner_timeline.start_date ?? b.banner_support!.banner_timeline.start_date
			)
			return aDate.getTime() - bDate.getTime()
		})

		setUserPlannedBannerData(updated)
		setStagedBanner(null)
	}

	// Only show section labels when both the staging area and the sheet are visible,
	// so the user understands which section is which.
	const showSectionLabels = stagedBanner !== null && userPlannedBannerData.length > 0

	return (
		<div className="page-container">
			<div className="flex mx-4 flex-col items-center gap-1.5">
				<div className="w-full border border-gray-600 rounded-lg shadow-sm overflow-hidden mt-2 pb-4">
					{/* Add banner buttons */}
					<div className="flex w-full py-4 gap-4 px-4">
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

					{/* Staging area — slides in/out as stagedBanner is set or cleared */}
					<AnimatePresence>
						{stagedBanner && (
							<motion.div
								key="staging-area"
								initial={{ opacity: 0, y: -6 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -6 }}
								transition={{ duration: 0.18 }}
								className="mx-4"
							>
								{showSectionLabels && (
									<div className="flex items-center gap-2 pb-2 px-1">
										<span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Staging</span>
										<div className="flex-1 h-px bg-amber-400/20" />
									</div>
								)}
								<div className="flex w-full items-center text-xs text-gray-400 font-medium bg-gray-800 border-b border-gray-700 rounded-t-lg py-1.5">
									<div className="w-17.5 shrink-0 text-center">Type</div>
									<div className="w-36 shrink-0 text-center">Images</div>
									<div className="w-44 shrink-0 text-center">Banner</div>
									<div className="w-32 shrink-0 text-center">Start / End Date</div>
									<div className="w-65 shrink-0 text-center">Confirm</div>
									<div className="w-22.5 shrink-0 text-center"># Pulls</div>
									<div className="flex-1 text-center">% Chance to MLB (5x Copies)</div>
									<div className="w-10 shrink-0 text-center"></div>
								</div>
								<StagedBannerRow
									stagedBanner={stagedBanner}
									setStagedBanner={(b) => setStagedBanner(b)}
									onConfirm={handleConfirmStagedBanner}
									onDiscard={() => setStagedBanner(null)}
									umaBannerData={umaBannerData}
									supportBannerData={supportBannerData}
									userPlannedBannerData={userPlannedBannerData}
								/>
							</motion.div>
						)}
					</AnimatePresence>

					{/* Confirmed banner sheet */}
					{userPlannedBannerData.length > 0 && (
						<div className="mx-4">
							{showSectionLabels && (
								<div className="flex items-center gap-2 pt-3 pb-2 px-1">
									<span className="text-xs font-semibold text-brand uppercase tracking-wider">Sheet</span>
									<div className="flex-1 h-px bg-brand/20" />
								</div>
							)}
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
								<AnimatePresence initial={false}>
									{userPlannedBannerData.map((plannedBanner, index) => {
										const resources = bannerResources[index] ?? {
											carats: 0,
											umaTickets: 0,
											supportTickets: 0
										}

										return (
											<motion.div
												key={plannedBanner.id ?? plannedBanner.tempId}
												layout
												initial={{ opacity: 0, y: -6 }}
												animate={{ opacity: 1, y: 0 }}
												exit={{ opacity: 0, y: -6 }}
												transition={{ duration: 0.18 }}
											>
												<BannerRow
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
											</motion.div>
										)
									})}
								</AnimatePresence>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
