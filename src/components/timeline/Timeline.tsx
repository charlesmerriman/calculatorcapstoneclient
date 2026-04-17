import { format } from "date-fns"
import { useCalculatorData } from "../../services/CalculatorContext"
import { IncomeForm } from "../carat-calculator/IncomeForm"
import { useEffect } from "react"
import type { ChampionsMeeting, BannerTimelineForViewing } from "../../types"

/**
 * TYPESCRIPT CONCEPT: Type Guards with `in` Operator
 *
 * When you have a union type (ChampionsMeeting | BannerTimelineForViewing),
 * you need to "narrow" it to know which variant you have before accessing
 * variant-specific fields. The `in` operator checks if a property exists
 * on an object, and TypeScript uses this to narrow the type.
 *
 * `"track" in event` narrows to ChampionsMeeting because only that type has `track`.
 * This is cleaner and more maintainable than using type assertions (`as ChampionsMeeting`).
 */
function isChampionsMeeting(
	event: ChampionsMeeting | BannerTimelineForViewing
): event is ChampionsMeeting {
	return "track" in event
}

export const Timeline = () => {
	const { organizedTimelineData, isDropdown, setIsDropdown } =
		useCalculatorData()

	useEffect(() => {
		setIsDropdown(false)
	}, [setIsDropdown])

	return (
		<div className="justify-center w-full min-h-screen bg-white lg:max-w-7xl mx-auto p-4">
			{isDropdown ? <IncomeForm /> : null}
			<div className="flex flex-col items-center">
				{organizedTimelineData.map((event, index) => {
					if (isChampionsMeeting(event)) {
						return (
							<div
								key={index}
								className="m-2 w-full flex flex-wrap lg:flex-nowrap font-medium text-lg"
							>
								<div className="w-full flex flex-col bg-neutral-200 rounded-xl p-2 border border-gray-200 shadow-sm justify-center items-center gap-2">
									<div className="w-full flex justify-center text-lg bg-gray-100 border-white rounded-xl font-medium">
										{format(event.start_date, "MMMM d, yyyy")} through{" "}
										{format(event.end_date, "MMMM d, yyyy")}
									</div>
									<div>Images are placeholders</div>
									<img src={event.image} alt={event.name} />
									<div className="flex flex-col items-center border-white p-2 bg-gray-100 shadow-sm rounded-xl w-full">
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
									<div className="flex text-center p-1 gap-4 md:gap-16">
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

					/**
					 * TYPESCRIPT CONCEPT: Narrowing by Elimination
					 *
					 * After the `if (isChampionsMeeting(event))` block above,
					 * TypeScript knows that `event` must be BannerTimelineForViewing
					 * in this branch — no additional check needed. This is called
					 * "narrowing by elimination" or "exhaustive narrowing."
					 */
					return (
						<div
							key={index}
							className="m-2 w-full flex flex-wrap lg:flex-nowrap"
						>
							<div className="w-full flex flex-col bg-neutral-200 p-2 border rounded-xl border-gray-200 shadow-sm">
								<div className="w-full flex justify-center text-lg bg-gray-100 border-white rounded-xl mb-2 font-medium">
									{format(event.start_date, "MMMM d, yyyy")} through{" "}
									{format(event.end_date, "MMMM d, yyyy")}
								</div>
								<div className="flex flex-col items-center md:grid md:grid-cols-[1fr_1fr_1fr]">
									<img
										src={event.image}
										alt={event.name}
										className="border-0 rounded-2xl"
									/>
									<div className="flex justify-center p-4 bg-gray-100 rounded-xl md:rounded-none md:rounded-l-xl m-1 h-full w-full">
										{event.banner_umas[0]?.umas.map((uma, umaIndex) => (
											<div
												key={umaIndex}
												className="flex flex-col items-center justify-between p-1 mx-1 border bg-white border-gray-200 rounded-xl min-w-1/2"
											>
												{uma.recommendation ? (
													<div className="flex justify-center items-center w-full text-center h-1/6 border border-gray-200 rounded-xl bg-blue-400 text-base font-medium">
														{uma.recommendation}
													</div>
												) : (
													<div className="h-1/6"></div>
												)}
												<img src={uma.image} alt={uma.name} />
												<div className="flex p-1 border border-white rounded-xl w-full text-center justify-center items-center h-1/4 text-sm font-medium">
													{uma.name}
												</div>
											</div>
										))}
									</div>
									<div className="flex justify-center p-4 bg-gray-100 rounded-xl md:rounded-none md:rounded-r-xl m-1 h-full w-full">
										{event.banner_supports[0]?.support_cards.map(
											(card, cardIndex) => (
												<div
													key={cardIndex}
													className="flex flex-col items-center justify-between p-1 mx-1 border bg-white border-gray-200 rounded-xl min-w-1/2"
												>
													{card.recommendation ? (
														<div className="flex p-1 mb-1 justify-center items-center w-full text-center h-1/6 border border-gray-200 rounded-xl bg-blue-400 text-base font-medium">
															{card.recommendation}
														</div>
													) : (
														<div className="h-1/6 p-1 mb-1"></div>
													)}
													<img src={card.image} alt={card.name} />
													<div className="flex p-1 border border-white rounded-xl w-full text-center justify-center items-center h-1/4 text-sm font-medium">
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
		</div>
	)
}