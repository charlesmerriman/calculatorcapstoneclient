import type React from "react"
import { useMemo } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"
import { useCalculatorData } from "../../services/CalculatorContext"
import { BannerRow } from "./BannerRow"
import { IncomeForm } from "./IncomeForm"
import { StagedBannerRow } from "./StagedBannerRow"
import { ReservedColumnIcons, RESERVED_COLUMN_TITLE } from "./ReservedColumnIcons"
import { PlannerSectionBand } from "./PlannerSectionBand"
import { buildPlannerRows, SCENARIO_BANDS_ONLY } from "../../utils/plannerSections"
import { EMPTY_BANNER_RESOURCES } from "../../hooks/bannerResources"
import { useBannerResources } from "../../hooks/useBannerResources"
import {
	nextTempId,
	plannedBannerKey,
	plannedBannerTarget,
	comparePlannedBanners,
} from "../../utils/bannerHelpers"
import type { BannerRowType } from "../../utils/bannerHelpers"
import type { UserPlannedBanner } from "../../types"

export const CaratCalculator: React.FC = () => {
	const {
		userStatsData,
		clubRankData,
		teamTrialsRankData,
		championsMeetingRankData,
		leagueOfHeroesRankData,
		umaBannerData,
		supportBannerData,
		stepUpBannerData,
		userStepUpSelectionData,
		userPlannedBannerData,
		stagedBanners,
		anniversaryEventData,
		scenarioData,
		userPlannedPurchaseData,
		incomeLedger,
		calculationConstants,
		setUserPlannedBannerData,
		setStagedBanners,
	} = useCalculatorData()

	const bannerResources = useBannerResources({
		userStatsData,
		clubRankData,
		teamTrialsRankData,
		championsMeetingRankData,
		leagueOfHeroesRankData,
		userPlannedBannerData,
		anniversaryEventData,
		userPlannedPurchaseData,
		incomeLedger,
		constants: calculationConstants,
	})

	// The sheet's render list: the same rows, with section bands interleaved for
	// the scenarios launching between the first and last banner.
	// Each row keeps its ORIGINAL index — bannerResources is positional against
	// userPlannedBannerData, so reading it by position in THIS list would
	// silently mis-attribute every row's resources once a band appears.
	// Scenario bands only, by constant rather than by setting — see
	// SCENARIO_BANDS_ONLY. anniversaryEventData is still passed because the
	// builder is what filters; the argument is not dead, it is just fully
	// filtered out today.
	const plannerRows = useMemo(
		() =>
			buildPlannerRows(
				userPlannedBannerData,
				scenarioData,
				anniversaryEventData,
				SCENARIO_BANDS_ONLY
			),
		[userPlannedBannerData, scenarioData, anniversaryEventData]
	)

	if (!userStatsData) {
		return <div>Loading...</div>
	}

	// Every click stages another row. The staging area is a queue, not a single
	// slot: a user planning several banners can line them all up, fill each one
	// in, and confirm them independently.
	const handleAddBanner = (bannerType: BannerRowType): void => {
		setStagedBanners((prev) => [
			...prev,
			{
				// From `prev`, never from the render-scoped stagedBanners — see nextTempId.
				tempId: nextTempId(userPlannedBannerData, prev),
				number_of_pulls: 0,
				reserved_copies: 0,
				initialBannerType: bannerType,
			} satisfies UserPlannedBanner,
		])
	}

	// Updates a single staged banner in the array when the user edits it.
	const handleUpdateStagedBanner = (updated: UserPlannedBanner): void => {
		setStagedBanners((prev) => prev.map((b) => (b.tempId === updated.tempId ? updated : b)))
	}

	const handleConfirmStagedBanner = (tempId: number): void => {
		const banner = stagedBanners.find((b) => b.tempId === tempId)
		if (!banner) return
		if (plannedBannerTarget(banner).type === "Empty") {
			toast.error("Please select a banner before adding it to the sheet.")
			return
		}
		// Compare by type+id, never by bare id — uma and support banners have
		// independent primary keys, so a bare id would reject the same-date support
		// counterpart of an already-planned uma banner (see plannedBannerKey).
		// The null guard matters here too: two rows with no banner selected are not
		// duplicates of each other.
		const stagedKey = plannedBannerKey(banner)
		const isDuplicate = stagedKey !== null && userPlannedBannerData.some((b) => plannedBannerKey(b) === stagedKey)
		if (isDuplicate) {
			toast.error("This banner is already on your sheet.")
			return
		}

		// Sorted by start date, ties broken by banner kind — see
		// comparePlannedBanners. The tie-break matters most here: appending then
		// sorting would otherwise drop the new row BELOW every existing row
		// sharing its start date, purely because it was added last.
		const updated = [...userPlannedBannerData, banner].sort(comparePlannedBanners)

		setUserPlannedBannerData(updated)
		setStagedBanners((prev) => prev.filter((b) => b.tempId !== tempId))
	}

	const handleDiscardStagedBanner = (tempId: number): void => {
		setStagedBanners((prev) => prev.filter((b) => b.tempId !== tempId))
	}

	// Only show section labels when both the staging area and the sheet are visible,
	// so the user understands which section is which.
	const showSectionLabels = stagedBanners.length > 0 && userPlannedBannerData.length > 0

	// Icon-only header, shared by the staging and sheet header rows below so the
	// two can't drift. Same icons the mobile card labels its Reserved cell with.
	const reservedHeaderCell = (
		<div className="flex items-center justify-center gap-1" title={RESERVED_COLUMN_TITLE}>
			<ReservedColumnIcons />
		</div>
	)

	return (
		<div className="w-full bg-gray-900">
			{/* The calculator gets a wider desktop canvas without changing Timeline's
			    shared .page-container. Income & Resources and the banner sheet share
			    this same width so their edges stay aligned. */}
			<div className="mx-auto w-full max-w-[96rem]">
				<div className="flex mx-2 flex-col items-center sm:mx-4">
					{/* Income inputs first, then the banner sheet they feed. IncomeForm
				    owns its own collapse state — it is a zero-prop panel like every
				    other one here, reading everything from the calculator context. */}
					<div className="w-full overflow-hidden rounded-xl border border-gray-600 bg-gray-900 shadow-sm">
						<IncomeForm />

						<div className="border-t border-gray-700 pb-4">
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
								<div className="hidden w-px bg-gray-700 self-stretch sm:block" />
								{/* Outlined in the step-up's own purple rather than the brand
								    colour its neighbours share: it plans a different kind of
								    thing (a paid-only cost ladder, not pulls), and the row it
								    creates carries that purple on its type badge. */}
								<button
									className="flex-1 py-2.5 rounded-lg border border-purple-400 text-purple-300 bg-transparent font-medium hover:bg-purple-400/10 transition"
									onClick={() => handleAddBanner("StepUp")}
								>
									⊕ Add Step-Up Banner
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
												{reservedHeaderCell}
												<div className="text-center">% Chance to MLB (5x Copies)</div>
												<div className="text-center"></div>
											</div>
											{/* Same spacing/divider rules as the sheet below: several staged
											    rows have to read as one list, gapped as cards on mobile and
											    ruled as table rows once the grid kicks in. */}
											<div className="space-y-3 @banner-table:space-y-0 @banner-table:divide-y @banner-table:divide-gray-700">
												<AnimatePresence initial={false}>
													{stagedBanners.map((banner) => (
														<motion.div
															key={banner.tempId}
															layout
															initial={{ opacity: 0, y: -6 }}
															animate={{ opacity: 1, y: 0 }}
															exit={{ opacity: 0, y: -6 }}
															transition={{ duration: 0.18 }}
														>
															<StagedBannerRow
																stagedBanner={banner}
																setStagedBanner={handleUpdateStagedBanner}
																onConfirm={() => handleConfirmStagedBanner(banner.tempId!)}
																onDiscard={() => handleDiscardStagedBanner(banner.tempId!)}
																umaBannerData={umaBannerData}
																supportBannerData={supportBannerData}
																stepUpBannerData={stepUpBannerData}
																constants={calculationConstants}
																userPlannedBannerData={userPlannedBannerData}
																stagedBanners={stagedBanners}
															/>
														</motion.div>
													))}
												</AnimatePresence>
											</div>
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
											{reservedHeaderCell}
											<div className="text-center">% Chance to MLB (5x Copies)</div>
											<div className="text-center"></div>
										</div>
										<div className="space-y-3 @banner-table:space-y-0 @banner-table:divide-y @banner-table:divide-gray-700">
											<AnimatePresence initial={false}>
												{plannerRows.map((plannerRow) => {
													if (plannerRow.kind === "band") {
														return (
															<motion.div
																key={plannerRow.key}
																layout
																initial={{ opacity: 0, y: -6 }}
																animate={{ opacity: 1, y: 0 }}
																exit={{ opacity: 0, y: -6 }}
																transition={{ duration: 0.18 }}
															>
																<PlannerSectionBand markers={plannerRow.markers} />
															</motion.div>
														)
													}

													const plannedBanner = plannerRow.banner
													const resources =
														bannerResources[plannerRow.index] ?? EMPTY_BANNER_RESOURCES

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
																stepUpBannerData={stepUpBannerData}
																userStepUpSelectionData={userStepUpSelectionData}
																constants={calculationConstants}
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
		</div>
	)
}
