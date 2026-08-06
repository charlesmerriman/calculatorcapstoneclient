import type React from "react"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"
import { useCalculatorData } from "../../services/CalculatorContext"
import { BannerRow } from "./BannerRow"
import { IncomeForm } from "./IncomeForm"
import { StagedBannerRow } from "./StagedBannerRow"
import { useBannerResources, EMPTY_BANNER_RESOURCES } from "../../hooks/useBannerResources"
import { plannedBannerKey } from "../../utils/bannerHelpers"
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
		gameEventsData,
		umaBannerData,
		supportBannerData,
		userPlannedBannerData,
		stagedBanners,
		setUserPlannedBannerData,
		setStagedBanners,
	} = useCalculatorData()

	const bannerResources = useBannerResources({
		userStatsData,
		clubRankData,
		teamTrialsRankData,
		championsMeetingRankData,
		leagueOfHeroesRankData,
		gameEventsData,
		championsMeetingData,
		leagueOfHeroesData,
		userPlannedBannerData
	})

	if (!userStatsData) {
		return <div>Loading...</div>
	}

	const handleAddBanner = (bannerType: "Uma" | "Support"): void => {
		const emptyStaged = stagedBanners.find(b => !b.banner_uma && !b.banner_support)

		if (emptyStaged) {
			if (emptyStaged.initialBannerType === bannerType) {
				// Same type already waiting — nothing to do.
				toast.error(`An empty ${bannerType} banner is already staged. Select a banner for it or discard it first.`)
				return
			}
			// Opposite type — replace it in-place so the user doesn't lose its position in the list.
			setStagedBanners((prev) =>
				prev.map(b => b.tempId === emptyStaged.tempId ? { ...b, initialBannerType: bannerType } : b)
			)
			return
		}

		// Generate a tempId higher than every existing id so there are never two banners sharing one.
		const allIds = [
			...userPlannedBannerData.map((b) => b.tempId ?? b.id ?? 0),
			...stagedBanners.map((b) => b.tempId ?? 0),
		]
		const highestId = allIds.length > 0 ? Math.max(...allIds) : 0

		setStagedBanners((prev) => [
			...prev,
			{ tempId: highestId + 1, number_of_pulls: 0, initialBannerType: bannerType } satisfies UserPlannedBanner
		])
	}

	// Updates a single staged banner in the array when the user edits it.
	const handleUpdateStagedBanner = (updated: UserPlannedBanner): void => {
		setStagedBanners((prev) => prev.map((b) => b.tempId === updated.tempId ? updated : b))
	}

	const handleConfirmStagedBanner = (tempId: number): void => {
		const banner = stagedBanners.find((b) => b.tempId === tempId)
		if (!banner) return
		if (!banner.banner_uma && !banner.banner_support) {
			toast.error("Please select a banner before adding it to the sheet.")
			return
		}
		// Compare by type+id, never by bare id — uma and support banners have
		// independent primary keys, so a bare id would reject the same-date support
		// counterpart of an already-planned uma banner (see plannedBannerKey).
		// The null guard matters here too: two rows with no banner selected are not
		// duplicates of each other.
		const stagedKey = plannedBannerKey(banner)
		const isDuplicate =
			stagedKey !== null &&
			userPlannedBannerData.some((b) => plannedBannerKey(b) === stagedKey)
		if (isDuplicate) {
			toast.error("This banner is already on your sheet.")
			return
		}

		const updated = [...userPlannedBannerData, banner].sort((a, b) => {
			const aDate = new Date(
				a.banner_uma?.banner_timeline.start_date ?? a.banner_support!.banner_timeline.start_date
			)
			const bDate = new Date(
				b.banner_uma?.banner_timeline.start_date ?? b.banner_support!.banner_timeline.start_date
			)
			return aDate.getTime() - bDate.getTime()
		})

		setUserPlannedBannerData(updated)
		setStagedBanners((prev) => prev.filter((b) => b.tempId !== tempId))
	}

	const handleDiscardStagedBanner = (tempId: number): void => {
		setStagedBanners((prev) => prev.filter((b) => b.tempId !== tempId))
	}

	// Only show section labels when both the staging area and the sheet are visible,
	// so the user understands which section is which.
	const showSectionLabels = stagedBanners.length > 0 && userPlannedBannerData.length > 0

	return (
		<div className="w-full bg-gray-900">
			{/* The calculator gets a wider desktop canvas without changing Timeline's
			    shared .page-container. Income & Resources and the banner sheet share
			    this same width so their edges stay aligned. */}
			<div className="mx-auto w-full max-w-[96rem]">
				<div className="flex mx-2 flex-col items-center gap-1.5 sm:mx-4">
				{/* Income inputs first, then the banner sheet they feed. IncomeForm
				    owns its own collapse state — it is a zero-prop panel like every
				    other one here, reading everything from the calculator context. */}
				<IncomeForm />

				<div className="w-full border border-gray-600 rounded-lg shadow-sm overflow-hidden mt-2 pb-4">
					{/* Add banner buttons */}
					<div className="flex w-full flex-col gap-3 px-3 py-4 sm:flex-row sm:gap-4 sm:px-4">
						<button
							className="flex-1 py-2.5 rounded-lg bg-brand text-black font-medium hover:bg-brand/90 transition"
							onClick={() => handleAddBanner("Uma")}
						>
							⊕ Add Uma Banner
						</button>
						<div className="hidden w-px bg-gray-700 self-stretch sm:block" />
						<button
							className="flex-1 py-2.5 rounded-lg border border-brand text-brand bg-transparent font-medium hover:bg-brand/10 transition"
							onClick={() => handleAddBanner("Support")}
						>
							⊕ Add Support Banner
						</button>
					</div>

					{/* Staging area — slides in/out as stagedBanners are added or cleared */}
					<AnimatePresence>
						{stagedBanners.length > 0 && (
							<motion.div
								key="staging-area"
								initial={{ opacity: 0, y: -6 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -6 }}
								transition={{ duration: 0.18 }}
								className="mx-3 sm:mx-4"
							>
								{showSectionLabels && (
									<div className="flex items-center gap-2 pb-2 px-1">
										<span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Staging</span>
										<div className="flex-1 h-px bg-amber-400/20" />
									</div>
								)}
								{/* @container: the card/table switch inside is keyed to THIS box's
								    width, not the viewport's, so the table is only ever shown at a
								    width that fits it and never has to scroll sideways. See
								    --container-banner-table in index.css. */}
								<div className="@container">
									<div className="banner-grid hidden w-full items-center text-xs text-gray-400 font-medium bg-gray-800 border-b border-gray-700 rounded-t-lg py-1.5 @banner-table:grid">
										<div className="text-center">Type</div>
										<div className="text-center">Images</div>
										<div className="text-center">Banner</div>
										<div className="text-center">Start / End Date</div>
										<div className="text-center">Confirm</div>
										<div className="text-center"># Pulls</div>
										<div className="text-center" title="Reserved for a future banner input">Reserved</div>
										<div className="text-center">% Chance to MLB (5x Copies)</div>
										<div className="text-center"></div>
									</div>
									{stagedBanners.map((banner) => (
										<StagedBannerRow
											key={banner.tempId}
											stagedBanner={banner}
											setStagedBanner={handleUpdateStagedBanner}
											onConfirm={() => handleConfirmStagedBanner(banner.tempId!)}
											onDiscard={() => handleDiscardStagedBanner(banner.tempId!)}
											umaBannerData={umaBannerData}
											supportBannerData={supportBannerData}
											userPlannedBannerData={userPlannedBannerData}
										/>
									))}
								</div>
							</motion.div>
						)}
					</AnimatePresence>

					{/* Confirmed banner sheet */}
					{userPlannedBannerData.length > 0 && (
						<div className="mx-3 sm:mx-4">
							{showSectionLabels && (
								<div className="flex items-center gap-2 pt-3 pb-2 px-1">
									<span className="text-xs font-semibold text-brand uppercase tracking-wider">Sheet</span>
									<div className="flex-1 h-px bg-brand/20" />
								</div>
							)}
							{/* Own @container, as in the staging area above. */}
							<div className="@container">
								<div className="banner-grid hidden w-full items-center text-xs text-gray-400 font-medium bg-gray-800 border-b border-gray-700 rounded-t-lg py-1.5 @banner-table:grid">
									<div className="text-center">Type</div>
									<div className="text-center">Images</div>
									<div className="text-center">Banner</div>
									<div className="text-center">Start / End Date</div>
									<div className="text-center">Derived Stats (Auto-Calculated)</div>
									<div className="text-center"># Pulls</div>
									<div className="text-center" title="Reserved for a future banner input">Reserved</div>
									<div className="text-center">% Chance to MLB (5x Copies)</div>
									<div className="text-center"></div>
								</div>
							<div className="space-y-3 @banner-table:space-y-0 @banner-table:divide-y @banner-table:divide-gray-700">
								<AnimatePresence initial={false}>
									{userPlannedBannerData.map((plannedBanner, index) => {
										const resources = bannerResources[index] ?? EMPTY_BANNER_RESOURCES

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
													resources={resources}
													initialBannerType={plannedBanner.initialBannerType}
												/>
											</motion.div>
										)
									})}
								</AnimatePresence>
							</div>
							</div>
						</div>
					)}
				</div>
				</div>
			</div>
		</div>
	)
}
