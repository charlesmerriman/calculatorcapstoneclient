import { useState, useEffect } from "react"
import { format } from "date-fns"
import { useCalculatorData } from "../../services/CalculatorContext"
import type { ChampionsMeeting, LeagueOfHeroes, BannerTimelineForViewing } from "../../types"

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
	const { organizedTimelineData } = useCalculatorData()
	const [showPast, setShowPast] = useState(false)
	const [searchQuery, setSearchQuery] = useState("")
	const [currentPage, setCurrentPage] = useState(1)

	const today = new Date()

	useEffect(() => {
		setCurrentPage(1)
	}, [showPast, searchQuery])

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
			<div className="grid grid-cols-3 items-center mt-6 mb-2 px-2 gap-4">
				<button
					className="justify-self-start px-3 py-1 text-sm rounded font-medium bg-gray-700 text-gray-100 border border-gray-600 hover:bg-gray-600 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
					onClick={() => setShowPast((prev) => !prev)}
				>
					{showPast ? "Show current/future events" : "Show past events"}
				</button>
				{totalPages > 1 ? (
					<div className="flex justify-center items-center gap-4">
						<button
							className="px-3 py-1 text-sm rounded font-medium bg-gray-700 text-gray-100 border border-gray-600 hover:bg-gray-600 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
							disabled={currentPage === 1}
							onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
						>
							Previous
						</button>
						<span className="text-sm font-medium text-gray-100">
							Page {currentPage} of {totalPages}
						</span>
						<button
							className="px-3 py-1 text-sm rounded font-medium bg-gray-700 text-gray-100 border border-gray-600 hover:bg-gray-600 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
						className="w-64 px-2 py-1 text-sm rounded border border-gray-600 bg-gray-700 text-gray-100 focus:outline-none focus:border-gray-500"
						placeholder="Search characters or events..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
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
							<div key={index} className="m-2 w-full flex flex-wrap lg:flex-nowrap font-medium text-lg">
								<div className="w-full flex flex-col card-panel rounded-xl p-2 justify-center items-center gap-2">
									<div className="w-full flex justify-center text-lg card-section rounded-xl font-medium">
										{format(event.start_date, "MMMM d, yyyy")} through{" "}
										{format(event.end_date, "MMMM d, yyyy")}
									</div>
									<div className="text-gray-100">Images are placeholders</div>
									<img src={event.image} alt={event.name} />
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
									<div className="flex text-center p-1 gap-4 md:gap-16 text-gray-100">
										<div className="flex flex-col">
											<img src="/00_CMSPEED1.png" />
											{event.speed_recommendation}
										</div>
										<div className="flex flex-col">
											<img src="/01_CMStamina1.png" />
											{event.stamina_recommendation}
										</div>
										<div className="flex flex-col">
											<img src="/02_CMPOWER1.png" />
											{event.power_recommendation}
										</div>
										<div className="flex flex-col">
											<img src="/03_CMGUTS1.png" />
											{event.guts_recommendation}
										</div>
										<div className="flex flex-col">
											<img src="/04_CMWits1.png" />
											{event.wit_recommendation}
										</div>
									</div>
								</div>
							</div>
						)
					}

					if (isLeagueOfHeroes(event)) {
						return (
							<div key={index} className="m-2 w-full flex flex-wrap lg:flex-nowrap font-medium text-lg">
								<div className="w-full flex flex-col card-panel rounded-xl p-2 justify-center items-center gap-2">
									<div className="w-full flex justify-center text-lg card-section rounded-xl font-medium">
										{format(event.start_date, "MMMM d, yyyy")} through{" "}
										{format(event.end_date, "MMMM d, yyyy")}
									</div>
									<div>{event.name}</div>
									{event.image && <img src={event.image} alt={event.name} />}
								</div>
							</div>
						)
					}

					return (
						<div key={index} className="m-2 w-full flex flex-wrap lg:flex-nowrap">
							<div className="w-full flex flex-col card-panel p-2 rounded-xl">
								<div className="w-full flex justify-center text-lg card-section rounded-xl mb-2 font-medium">
									{format(event.start_date, "MMMM d, yyyy")} through{" "}
									{format(event.end_date, "MMMM d, yyyy")}
								</div>
								<div className="flex flex-col items-center md:grid md:grid-cols-[1fr_1fr_1fr]">
									<img
										src={event.image}
										alt={event.name}
										className="border-0 rounded-2xl"
									/>
									<div className="flex justify-center p-4 bg-gray-800 rounded-xl md:rounded-none md:rounded-l-xl m-1 h-full w-full">
										{event.banner_umas[0]?.umas.map((uma, umaIndex) => (
											<div
												key={umaIndex}
												className="flex flex-col items-center justify-between p-1 mx-1 border bg-gray-700 border-gray-600 rounded-xl min-w-1/2"
											>
												{uma.recommendation ? (
													<div className="flex justify-center items-center w-full text-center h-1/6 border border-gray-600 rounded-xl bg-blue-700 text-gray-100 value-bold">
														{uma.recommendation}
													</div>
												) : (
													<div className="h-1/6"></div>
												)}
												<img src={uma.image} alt={uma.name} />
												<div className="flex p-1 border border-gray-600 rounded-xl w-full text-center justify-center items-center h-1/4 text-sm font-medium text-gray-100">
													{uma.name}
												</div>
											</div>
										))}
									</div>
									<div className="flex justify-center p-4 bg-gray-800 rounded-xl md:rounded-none md:rounded-r-xl m-1 h-full w-full">
										{event.banner_supports[0]?.support_cards.map(
											(card, cardIndex) => (
												<div
													key={cardIndex}
													className="flex flex-col items-center justify-between p-1 mx-1 border bg-gray-700 border-gray-600 rounded-xl min-w-1/2"
												>
													{card.recommendation ? (
														<div className="flex p-1 mb-1 justify-center items-center w-full text-center h-1/6 border border-gray-600 rounded-xl bg-blue-700 text-gray-100 value-bold">
															{card.recommendation}
														</div>
													) : (
														<div className="h-1/6 p-1 mb-1"></div>
													)}
													<img src={card.image} alt={card.name} />
													<div className="flex p-1 border border-gray-600 rounded-xl w-full text-center justify-center items-center h-1/4 text-sm font-medium text-gray-100">
														{card.name}
													</div>
												</div>
											)
										)}
									</div>
								</div>
							</div>
						</div>
					)
				})}
			</div>

			{totalPages > 1 && (
				<div className="flex justify-center items-center gap-4 mt-2">
					<button
						className="px-3 py-1 text-sm rounded font-medium bg-gray-700 text-gray-100 border border-gray-600 hover:bg-gray-600 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
						disabled={currentPage === 1}
						onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
					>
						Previous
					</button>
					<span className="text-sm font-medium text-gray-100">
						Page {currentPage} of {totalPages}
					</span>
					<button
						className="px-3 py-1 text-sm rounded font-medium bg-gray-700 text-gray-100 border border-gray-600 hover:bg-gray-600 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
