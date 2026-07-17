import { useState } from "react"
import { differenceInCalendarDays, format } from "date-fns"
import {
	CalendarDays,
	ChevronLeft,
	ChevronRight,
	Clock3,
	History,
	Search,
	Sparkles,
	Star,
	Ticket,
} from "lucide-react"
import { toast } from "sonner"
import { useCalculatorData } from "../../services/CalculatorContext"
import PredictedBadge from "../PredictedBadge"
import type {
	ChampionsMeeting,
	LeagueOfHeroes,
	BannerTimelineForViewing,
	BannerUma,
	BannerSupport,
	UserPlannedBanner,
} from "../../types"

const PAGE_SIZE = 10
const controlButtonClass =
	"inline-flex min-h-10 items-center justify-center gap-2 rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm font-medium text-gray-100 shadow-sm transition hover:border-gray-500 hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-45 md:min-h-0 md:py-1.5"
const paginationButtonClass = `${controlButtonClass} min-w-28`
const pageIndicatorClass =
	"inline-flex min-h-10 items-center justify-center rounded border border-gray-700 bg-gray-950/50 px-4 py-2 text-sm font-semibold text-gray-200 shadow-inner md:min-h-0 md:py-1.5"
const searchInputClass =
	"w-full rounded border border-gray-600 bg-gray-800 py-2 pl-9 pr-3 text-sm text-gray-100 shadow-sm placeholder:text-gray-400 transition focus:border-gray-500 focus:bg-gray-800 focus:outline-none md:py-1.5"

type BannerCardStatus = "available" | "planned" | "staged" | "expired"

type PaginationControlsProps = {
	currentPage: number
	totalPages: number
	onPrevious: () => void
	onNext: () => void
}

function PaginationControls({
	currentPage,
	totalPages,
	onPrevious,
	onNext,
}: PaginationControlsProps) {
	return (
		<div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
			<button
				type="button"
				className={paginationButtonClass}
				disabled={currentPage === 1}
				onClick={onPrevious}
			>
				<ChevronLeft className="h-4 w-4" />
				Previous
			</button>
			<span className={pageIndicatorClass}>
				Page <span className="mx-1 text-brand">{currentPage}</span> of {totalPages}
			</span>
			<button
				type="button"
				className={paginationButtonClass}
				disabled={currentPage === totalPages}
				onClick={onNext}
			>
				Next
				<ChevronRight className="h-4 w-4" />
			</button>
		</div>
	)
}

function isChampionsMeeting(
	event: ChampionsMeeting | LeagueOfHeroes | BannerTimelineForViewing
): event is ChampionsMeeting {
	return "track" in event
}

function isLeagueOfHeroes(
	event: ChampionsMeeting | LeagueOfHeroes | BannerTimelineForViewing
): event is LeagueOfHeroes {
	return !("track" in event) && !("banner_umas" in event)
}


function eventMatchesSearch(
	event: ChampionsMeeting | LeagueOfHeroes | BannerTimelineForViewing,
	query: string
): boolean {
	const q = query.toLowerCase()
	if (isChampionsMeeting(event)) {
		return event.name.toLowerCase().includes(q) || event.track.toLowerCase().includes(q)
	}
	if (isLeagueOfHeroes(event)) {
		return event.name.toLowerCase().includes(q)
	}
	// TypeScript collapses the remaining type to `never` here because
	// BannerTimelineForViewing is structurally assignable to LeagueOfHeroes
	// (same base fields), so the negative guards' Exclude produces never.
	// The cast is logically safe: we've already ruled out both other branches.
	const bannerEvent = event as unknown as BannerTimelineForViewing
	if (bannerEvent.name.toLowerCase().includes(q)) return true
	for (const banner of bannerEvent.banner_umas) {
		for (const uma of banner.umas) {
			if (uma.name.toLowerCase().includes(q)) return true
		}
	}
	for (const banner of bannerEvent.banner_supports) {
		for (const card of banner.support_cards) {
			if (card.name.toLowerCase().includes(q)) return true
		}
	}
	return false
}

function getBannerCardStatus(
	hasBanner: boolean,
	expired: boolean,
	planned: boolean,
	staged: boolean
): BannerCardStatus {
	if (!hasBanner || expired) return "expired"
	if (planned) return "planned"
	if (staged) return "staged"
	return "available"
}

function getBannerStatusLabel(status: BannerCardStatus): string {
	if (status === "planned") return "Already on sheet"
	if (status === "staged") return "Already staged"
	if (status === "expired") return "Banner ended"
	return "Add to Planner"
}

function getBannerStatusClasses(status: BannerCardStatus): string {
	if (status === "available") return "border-brand text-brand hover:bg-brand/10"
	if (status === "planned" || status === "staged") return "border-gray-600 text-gray-300"
	return "border-gray-600 text-gray-500"
}

function getDurationDays(startDate: string, endDate: string): number {
	return differenceInCalendarDays(new Date(endDate), new Date(startDate)) + 1
}

export const Timeline = () => {
	const {
		organizedTimelineData,
		userPlannedBannerData,
		umaBannerData,
		supportBannerData,
		stagedBanners,
		setStagedBanners,
	} = useCalculatorData()
	const [showPast, setShowPast] = useState(false)
	const [searchQuery, setSearchQuery] = useState("")
	const [currentPage, setCurrentPage] = useState(1)

	const today = new Date()

	// Set of banner IDs already on the planner sheet — used for duplicate checks and button state.
	const plannedBannerIds = new Set(
		userPlannedBannerData
			.map((b) => b.banner_uma?.id ?? b.banner_support?.id)
			.filter((id): id is number => id !== undefined)
	)

	// Banners nested inside BannerTimelineForViewing have banner_timeline omitted by the API serializer.
	// We look up the full object from umaBannerData/supportBannerData (which always include it)
	// so the staged banner in CaratCalculator is structurally complete.
	const handleAddBanner = (banner: BannerUma | BannerSupport, type: "Uma" | "Support"): void => {
		const fullBanner = type === "Uma"
			? umaBannerData.find((b) => b.id === banner.id)
			: supportBannerData.find((b) => b.id === banner.id)

		if (!fullBanner) {
			toast.error("Could not find banner data. Try refreshing the page.")
			return
		}

		const allIds = [
			...userPlannedBannerData.map((b) => b.tempId ?? b.id ?? 0),
			...stagedBanners.map((b) => b.tempId ?? 0),
		]
		const highestId = allIds.length > 0 ? Math.max(...allIds) : 0

		const newStaged: UserPlannedBanner = type === "Uma"
			? { tempId: highestId + 1, number_of_pulls: 0, banner_uma: fullBanner as BannerUma, initialBannerType: "Uma" }
			: { tempId: highestId + 1, number_of_pulls: 0, banner_support: fullBanner as BannerSupport, initialBannerType: "Support" }

		setStagedBanners((prev) => [...prev, newStaged])
		toast.success(`${fullBanner.name} staged! Head to the Calculator to confirm.`)
	}

	const filteredEvents = organizedTimelineData
		.filter((event) =>
			showPast
				? new Date(event.end_date) < today
				: new Date(event.end_date) >= today
		)
		.filter((event) => searchQuery === "" || eventMatchesSearch(event, searchQuery))

	const totalPages = Math.max(1, Math.ceil(filteredEvents.length / PAGE_SIZE))
	const pagedEvents = filteredEvents.slice(
		(currentPage - 1) * PAGE_SIZE,
		currentPage * PAGE_SIZE
	)

	return (
		<div className="w-full bg-gray-900 pb-6">
			<div className="border-y border-gray-700/60 bg-gray-950/40 shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
				<div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-stretch gap-3 px-3 py-3 md:grid-cols-[1fr_auto_1fr] md:items-center md:px-2">
					<button
						type="button"
						className={`${controlButtonClass} w-full justify-self-start md:w-auto`}
						onClick={() => { setShowPast((prev) => !prev); setCurrentPage(1) }}
					>
						<History className="h-4 w-4 text-brand" />
						{showPast ? "Show current/future events" : "Show past events"}
					</button>
					{totalPages > 1 ? (
						<PaginationControls
							currentPage={currentPage}
							totalPages={totalPages}
							onPrevious={() => setCurrentPage((p) => Math.max(1, p - 1))}
							onNext={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
						/>
					) : <div />}
					<div className="flex justify-end">
						<div className="relative w-full md:w-64">
							<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
							<input
								type="text"
								className={searchInputClass}
								placeholder="Search characters or events..."
								value={searchQuery}
								onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
							/>
						</div>
					</div>
				</div>
			</div>

			<div className="page-container flex flex-col items-center">
				{pagedEvents.length === 0 && (
					<div className="text-gray-500 mt-8">No events found.</div>
				)}
				{pagedEvents.map((event, index) => {
					if (isChampionsMeeting(event)) {
						return (
							<div key={index} className="my-2 w-full px-2 flex flex-wrap lg:flex-nowrap font-medium text-base sm:text-lg">
								<div className="w-full flex flex-col card-panel rounded-xl p-2 justify-center items-center gap-2">
									<div className="w-full flex justify-center text-center text-sm sm:text-lg card-section rounded-xl font-medium">
										{format(event.start_date, "MMMM d, yyyy")} through{" "}
										{format(event.end_date, "MMMM d, yyyy")}
									</div>
									<div className="text-gray-100">Images are placeholders</div>
									<img src={event.image} alt={event.name} className="max-w-full h-auto" />
									<div className="flex flex-col items-center card-section shadow-sm rounded-xl w-full">
										<div className="flex flex-wrap gap-4 md:gap-16 justify-center">
											<div>{event.track}</div>
											<div>{event.surface_type}</div>
											<div>{event.distance}</div>
											<div>{event.length}</div>
											<div>{event.direction}</div>
											<div>{event.track_condition}</div>
											<div>{event.season}</div>
											<div>{event.weather}</div>
										</div>
									</div>
									<div className="grid w-full grid-cols-2 gap-3 p-1 text-center text-gray-100 sm:grid-cols-3 lg:grid-cols-5">
										<div className="flex flex-col items-center">
											<img src="/00_CMSPEED1.png" className="max-w-16" />
											{event.speed_recommendation}
										</div>
										<div className="flex flex-col items-center">
											<img src="/01_CMStamina1.png" className="max-w-16" />
											{event.stamina_recommendation}
										</div>
										<div className="flex flex-col items-center">
											<img src="/02_CMPOWER1.png" className="max-w-16" />
											{event.power_recommendation}
										</div>
										<div className="flex flex-col items-center">
											<img src="/03_CMGUTS1.png" className="max-w-16" />
											{event.guts_recommendation}
										</div>
										<div className="flex flex-col items-center">
											<img src="/04_CMWits1.png" className="max-w-16" />
											{event.wit_recommendation}
										</div>
									</div>
								</div>
							</div>
						)
					}

					if (isLeagueOfHeroes(event)) {
						return (
							<div key={index} className="my-2 w-full px-2 flex flex-wrap lg:flex-nowrap font-medium text-base sm:text-lg">
								<div className="w-full flex flex-col card-panel rounded-xl p-2 justify-center items-center gap-2">
									<div className="w-full flex justify-center text-center text-sm sm:text-lg card-section rounded-xl font-medium">
										{format(event.start_date, "MMMM d, yyyy")} through{" "}
										{format(event.end_date, "MMMM d, yyyy")}
									</div>
									<div>{event.name}</div>
									{event.image && <img src={event.image} alt={event.name} className="max-w-full h-auto" />}
								</div>
							</div>
						)
					}

					// BannerTimelineForViewing.
					// TypeScript collapses the remaining type to `never` here because
					// BannerTimelineForViewing is structurally assignable to LeagueOfHeroes
					// (same base fields), so the negative guard's Exclude produces never.
					// The cast is logically safe: we've already ruled out both other branches.
					const bannerEvent = event as unknown as BannerTimelineForViewing
					const umaBanner = bannerEvent.banner_umas[0]
					const supportBanner = bannerEvent.banner_supports[0]

					const umaExpired     = !umaBanner     || new Date(bannerEvent.end_date) <= today
					const supportExpired = !supportBanner || new Date(bannerEvent.end_date) <= today
					const umaPlanned     = umaBanner     ? plannedBannerIds.has(umaBanner.id)                    : false
					const supportPlanned = supportBanner ? plannedBannerIds.has(supportBanner.id)                : false
					const umaStaged      = umaBanner     ? stagedBanners.some((b) => b.banner_uma?.id === umaBanner.id)         : false
					const supportStaged  = supportBanner ? stagedBanners.some((b) => b.banner_support?.id === supportBanner.id) : false
					const umaStatus = getBannerCardStatus(!!umaBanner, umaExpired, umaPlanned, umaStaged)
					const supportStatus = getBannerCardStatus(!!supportBanner, supportExpired, supportPlanned, supportStaged)
					const durationDays = getDurationDays(bannerEvent.start_date, bannerEvent.end_date)
					const umaFeatureGridClass = umaBanner && umaBanner.umas.length === 1
						? "grid-cols-1"
						: "grid-cols-2"
					const supportFeatureGridClass = supportBanner && supportBanner.support_cards.length === 1
						? "grid-cols-1"
						: "grid-cols-2"

					return (
						<div key={index} className="my-3 w-full px-2">
							<div className="card-panel w-full overflow-hidden rounded-xl p-2 sm:p-3">
								<div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
									<div className="flex min-w-0 items-center gap-3">
										<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-600 bg-gray-700 text-brand">
											<CalendarDays className="h-5 w-5" />
										</div>
										<div className="min-w-0 text-xl font-semibold text-gray-100 sm:text-2xl">
											<div className="flex flex-wrap items-center gap-2">
												<span>
													{format(bannerEvent.start_date, "MMMM d, yyyy")} through{" "}
													{format(bannerEvent.end_date, "MMMM d, yyyy")}
												</span>
												{bannerEvent.is_predicted && <PredictedBadge />}
											</div>
										</div>
									</div>
									<div className="flex w-fit items-center gap-2 rounded-full border border-gray-600 bg-gray-700 px-3 py-1 text-sm font-semibold text-gray-100">
										<span>{durationDays} Days</span>
										<Clock3 className="h-4 w-4 text-brand" />
									</div>
								</div>

								<div className="grid gap-4 xl:grid-cols-[minmax(360px,1.28fr)_minmax(260px,0.88fr)_minmax(260px,0.78fr)] xl:items-stretch">
									<div className="min-w-0">
										<img
											src={bannerEvent.image}
											alt={bannerEvent.name}
											className="h-auto w-full rounded-xl border border-gray-600 shadow-md"
										/>
									</div>

									<section className="flex min-w-0 flex-col rounded-xl border border-gray-600 bg-gray-800 px-1.5 py-1.5 shadow-sm xl:overflow-hidden">
										<div className="mb-1.5 flex shrink-0 items-center gap-2 text-sm font-semibold text-brand">
											<Sparkles className="h-4 w-4" />
											<span>Featured Umamusume</span>
										</div>
										{umaBanner ? (
											<div className="flex flex-1 flex-col gap-1.5 xl:min-h-0 xl:overflow-hidden">
												<div className={`grid grid-rows-1 flex-1 items-stretch justify-items-center content-stretch gap-1.5 xl:min-h-0 xl:overflow-hidden ${umaFeatureGridClass}`}>
													{umaBanner.umas.map((uma, umaIndex) => (
														<div
															key={umaIndex}
															className="flex h-full min-w-0 max-w-[10rem] flex-col overflow-hidden rounded-lg bg-gray-700 text-left shadow-sm"
														>
															<div className="relative shrink-0 overflow-hidden bg-gray-700">
																{uma.recommendation && (
																	<div className="absolute left-2 top-2 z-10 rounded border border-gray-600 bg-gray-700/95 px-2 py-1 text-xs font-semibold text-brand">
																		{uma.recommendation}
																	</div>
																)}
																<img
																	src={uma.image}
																	alt={uma.name}
																	className="block h-auto w-full object-contain"
																/>
															</div>
															<div className="flex flex-1 flex-col justify-center p-1.5">
																<div className="line-clamp-2 min-h-[2rem] overflow-hidden break-words text-center text-sm font-semibold leading-tight text-gray-100">
																	{uma.name}
																</div>
															</div>
														</div>
													))}
												</div>
												{/* Single shared action button — both featured umas belong to the same
												    banner, so one full-width button drives the add for all of them. */}
												<button
													type="button"
													onClick={() => handleAddBanner(umaBanner, "Uma")}
													disabled={umaStatus !== "available"}
													className={`flex shrink-0 items-center justify-center gap-2 rounded-lg border px-2 py-2 text-xs font-medium leading-tight transition ${getBannerStatusClasses(umaStatus)} ${
														umaStatus === "available" ? "cursor-pointer" : "cursor-not-allowed"
													}`}
												>
													<Star className="h-3.5 w-3.5" />
													{getBannerStatusLabel(umaStatus)}
													{umaStatus === "available" && <ChevronRight className="h-3.5 w-3.5" />}
												</button>
											</div>
										) : (
											<div className="flex min-h-40 w-full flex-1 items-center justify-center rounded-lg border border-gray-600 bg-gray-700 px-4 text-center text-sm text-gray-400">
												No Umamusume banner in this window.
											</div>
										)}
									</section>

									<section className="flex min-w-0 flex-col rounded-xl border border-gray-600 bg-gray-800 px-1.5 py-1.5 shadow-sm xl:overflow-hidden">
										<div className="mb-1.5 flex shrink-0 items-center gap-2 text-sm font-semibold text-brand">
											<Ticket className="h-4 w-4" />
											<span>Featured Support Cards</span>
										</div>
										{supportBanner ? (
											<div className="flex flex-1 flex-col gap-1.5 xl:min-h-0 xl:overflow-hidden">
												<div className={`grid grid-rows-1 flex-1 items-stretch justify-items-center content-stretch gap-1.5 xl:min-h-0 xl:overflow-hidden ${supportFeatureGridClass}`}>
													{supportBanner.support_cards.map((card, cardIndex) => (
														<div
															key={cardIndex}
															className="flex h-full min-w-0 max-w-[7.75rem] flex-col overflow-hidden rounded-lg bg-gray-700 text-left shadow-sm"
														>
															<div className="relative shrink-0 overflow-hidden bg-gray-700">
																{card.recommendation && (
																	<div className="absolute left-2 top-2 z-10 rounded border border-gray-600 bg-gray-700/95 px-2 py-1 text-xs font-semibold text-brand">
																		{card.recommendation}
																	</div>
																)}
																<img
																	src={card.image}
																	alt={card.name}
																	className="block h-auto w-full object-contain"
																/>
															</div>
															<div className="flex flex-1 flex-col justify-center p-1.5">
																<div className="line-clamp-2 min-h-[2rem] overflow-hidden break-words text-center text-sm font-semibold leading-tight text-gray-100">
																	{card.name}
																</div>
															</div>
														</div>
													))}
												</div>
												{/* Single shared action button — all featured support cards belong to the
												    same banner, so one full-width button drives the add for all of them. */}
												<button
													type="button"
													onClick={() => handleAddBanner(supportBanner, "Support")}
													disabled={supportStatus !== "available"}
													className={`flex shrink-0 items-center justify-center gap-2 rounded-lg border px-2 py-2 text-xs font-medium leading-tight transition ${getBannerStatusClasses(supportStatus)} ${
														supportStatus === "available" ? "cursor-pointer" : "cursor-not-allowed"
													}`}
												>
													<Ticket className="h-3.5 w-3.5" />
													{getBannerStatusLabel(supportStatus)}
													{supportStatus === "available" && <ChevronRight className="h-3.5 w-3.5" />}
												</button>
											</div>
										) : (
											<div className="flex min-h-40 w-full flex-1 items-center justify-center rounded-lg border border-gray-600 bg-gray-700 px-4 text-center text-sm text-gray-400">
												No support banner in this window.
											</div>
										)}
									</section>
								</div>
							</div>
						</div>
					)
				})}
			</div>

			{totalPages > 1 && (
				<div className="mx-auto mt-2 w-fit max-w-[calc(100%-1.5rem)] rounded-lg border border-gray-700/60 bg-gray-950/40 px-3 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
					<PaginationControls
						currentPage={currentPage}
						totalPages={totalPages}
						onPrevious={() => setCurrentPage((p) => Math.max(1, p - 1))}
						onNext={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
					/>
				</div>
			)}
		</div>
	)
}
