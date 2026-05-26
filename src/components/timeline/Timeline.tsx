import { useState } from "react"
import { format } from "date-fns"
import { toast } from "sonner"
import { useCalculatorData } from "../../services/CalculatorContext"
import type {
	ChampionsMeeting,
	LeagueOfHeroes,
	BannerTimelineForViewing,
	BannerUma,
	BannerSupport,
	UserPlannedBanner,
} from "../../types"

const PAGE_SIZE = 10

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
	if (event.name.toLowerCase().includes(q)) return true
	for (const banner of event.banner_umas) {
		for (const uma of banner.umas) {
			if (uma.name.toLowerCase().includes(q)) return true
		}
	}
	for (const banner of event.banner_supports) {
		for (const card of banner.support_cards) {
			if (card.name.toLowerCase().includes(q)) return true
		}
	}
	return false
}

export const Timeline = () => {
	const {
		organizedTimelineData,
		userPlannedBannerData,
		umaBannerData,
		supportBannerData,
		stagedBanner,
		setStagedBanner,
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
			stagedBanner ? (stagedBanner.tempId ?? 0) : 0,
		]
		const highestId = allIds.length > 0 ? Math.max(...allIds) : 0

		const newStaged: UserPlannedBanner = type === "Uma"
			? { tempId: highestId + 1, number_of_pulls: 0, banner_uma: fullBanner as BannerUma, initialBannerType: "Uma" }
			: { tempId: highestId + 1, number_of_pulls: 0, banner_support: fullBanner as BannerSupport, initialBannerType: "Support" }

		setStagedBanner(newStaged)
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
		<div className="page-container pb-6">
			<div className="grid grid-cols-1 items-stretch gap-3 px-3 pt-4 pb-2 md:grid-cols-3 md:items-center md:px-2 md:pt-6">
				<button
					className="w-full justify-self-start rounded border border-gray-600 bg-gray-700 px-3 py-2 text-sm font-medium text-gray-100 transition hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto md:py-1"
					onClick={() => { setShowPast((prev) => !prev); setCurrentPage(1) }}
				>
					{showPast ? "Show current/future events" : "Show past events"}
				</button>
				{totalPages > 1 ? (
					<div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
						<button
							className="rounded border border-gray-600 bg-gray-700 px-3 py-2 text-sm font-medium text-gray-100 transition hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50 md:py-1"
							disabled={currentPage === 1}
							onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
						>
							Previous
						</button>
						<span className="text-sm font-medium text-gray-100">
							Page {currentPage} of {totalPages}
						</span>
						<button
							className="rounded border border-gray-600 bg-gray-700 px-3 py-2 text-sm font-medium text-gray-100 transition hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50 md:py-1"
							disabled={currentPage === totalPages}
							onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
						>
							Next
						</button>
					</div>
				) : <div />}
				<div className="flex justify-end">
					<input
						type="text"
						className="w-full rounded border border-gray-600 bg-gray-700 px-2 py-2 text-sm text-gray-100 focus:border-gray-500 focus:outline-none md:w-64 md:py-1"
						placeholder="Search characters or events..."
						value={searchQuery}
						onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
					/>
				</div>
			</div>

			<div className="flex flex-col items-center">
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
					const umaStaged      = umaBanner     ? stagedBanner?.banner_uma?.id === umaBanner.id         : false
					const supportStaged  = supportBanner ? stagedBanner?.banner_support?.id === supportBanner.id : false

					return (
						<div key={index} className="my-2 w-full px-2 flex flex-wrap lg:flex-nowrap">
							<div className="w-full flex flex-col card-panel p-2 rounded-xl">
								<div className="w-full flex justify-center text-center text-sm sm:text-lg card-section rounded-xl mb-2 font-medium">
									{format(bannerEvent.start_date, "MMMM d, yyyy")} through{" "}
									{format(bannerEvent.end_date, "MMMM d, yyyy")}
								</div>
								<div className="flex flex-col items-center md:grid md:grid-cols-[1fr_1fr_1fr]">
									<img
										src={bannerEvent.image}
										alt={bannerEvent.name}
										className="max-w-full h-auto border-0 rounded-2xl"
									/>

									{/* Uma banner column — single shared border wraps all characters */}
									<div className="flex flex-col p-3 sm:p-4 bg-gray-800 border border-gray-600 rounded-xl md:rounded-none md:rounded-l-xl my-2 md:m-1 h-full w-full gap-3">
										<div className="flex justify-center flex-1">
											{umaBanner?.umas.map((uma, umaIndex) => (
												<div
													key={umaIndex}
													className="flex min-w-0 flex-1 flex-col items-center justify-between p-1 mx-1"
												>
													{uma.recommendation ? (
														<div className="flex justify-center items-center w-full text-center h-1/6 border border-gray-600 rounded-xl bg-blue-700 text-gray-100 value-bold">
															{uma.recommendation}
														</div>
													) : (
														<div className="h-1/6"></div>
													)}
													<img src={uma.image} alt={uma.name} className="max-h-28 max-w-full w-auto" />
													<div className="flex p-1 border border-gray-600 rounded-xl w-full text-center justify-center items-center h-1/4 text-sm font-medium text-gray-100">
														{uma.name}
													</div>
												</div>
											))}
										</div>
										{umaBanner && (
											<button
												onClick={() => handleAddBanner(umaBanner, "Uma")}
												disabled={umaExpired || umaPlanned || umaStaged}
												className={`w-full py-1 text-sm rounded-lg font-medium border transition ${
													umaExpired || umaPlanned || umaStaged
														? "border-gray-600 text-gray-500 cursor-not-allowed"
														: "border-brand text-brand hover:bg-brand/10 cursor-pointer"
												}`}
											>
												{umaPlanned ? "Already on sheet" : umaStaged ? "Already staged" : umaExpired ? "Banner ended" : "Add to Planner"}
											</button>
										)}
									</div>

									{/* Support banner column — single shared border wraps all cards */}
									<div className="flex flex-col p-3 sm:p-4 bg-gray-800 border border-gray-600 rounded-xl md:rounded-none md:rounded-r-xl my-2 md:m-1 h-full w-full gap-3">
										<div className="flex justify-center flex-1">
											{supportBanner?.support_cards.map((card, cardIndex) => (
												<div
													key={cardIndex}
													className="flex min-w-0 flex-1 flex-col items-center justify-between p-1 mx-1"
												>
													{card.recommendation ? (
														<div className="flex p-1 mb-1 justify-center items-center w-full text-center h-1/6 border border-gray-600 rounded-xl bg-blue-700 text-gray-100 value-bold">
															{card.recommendation}
														</div>
													) : (
														<div className="h-1/6 p-1 mb-1"></div>
													)}
													<img src={card.image} alt={card.name} className="max-h-28 max-w-full w-auto" />
													<div className="flex p-1 border border-gray-600 rounded-xl w-full text-center justify-center items-center h-1/4 text-sm font-medium text-gray-100">
														{card.name}
													</div>
												</div>
											))}
										</div>
										{supportBanner && (
											<button
												onClick={() => handleAddBanner(supportBanner, "Support")}
												disabled={supportExpired || supportPlanned || supportStaged}
												className={`w-full py-1 text-sm rounded-lg font-medium border transition ${
													supportExpired || supportPlanned || supportStaged
														? "border-gray-600 text-gray-500 cursor-not-allowed"
														: "border-brand text-brand hover:bg-brand/10 cursor-pointer"
												}`}
											>
												{supportPlanned ? "Already on sheet" : supportStaged ? "Already staged" : supportExpired ? "Banner ended" : "Add to Planner"}
											</button>
										)}
									</div>
								</div>
							</div>
						</div>
					)
				})}
			</div>

			{totalPages > 1 && (
				<div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:gap-4">
					<button
						className="rounded border border-gray-600 bg-gray-700 px-3 py-2 text-sm font-medium text-gray-100 transition hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50 md:py-1"
						disabled={currentPage === 1}
						onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
					>
						Previous
					</button>
					<span className="text-sm font-medium text-gray-100">
						Page {currentPage} of {totalPages}
					</span>
					<button
						className="rounded border border-gray-600 bg-gray-700 px-3 py-2 text-sm font-medium text-gray-100 transition hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50 md:py-1"
						disabled={currentPage === totalPages}
						onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
					>
						Next
					</button>
				</div>
			)}
		</div>
	)
}
