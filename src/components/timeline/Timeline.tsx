import { format } from "date-fns"
import { useCalculatorData } from "../../services/CalculatorContext"
import { IncomeForm } from "../carat-calculator/IncomeForm"
import { useEffect } from "react"

export const Timeline = () => {
	const { organizedTimelineData, isDropdown, setIsDropdown } =
		useCalculatorData()

	useEffect(() => {
		setIsDropdown(false)
	}, [setIsDropdown])

	return (
		<div className="justify-center w-full min-h-screen bg-white lg:max-w-7xl mx-auto p-4">
			{isDropdown ? <IncomeForm /> : ""}
			<div>
				{organizedTimelineData.map((event, index) => {
					if ("track" in event) {
						return (
							<div
								key={index}
								className="m-2 w-full flex flex-wrap lg:flex-nowrap"
							>
								<div className="w-full flex flex-wrap bg-neutral-200 rounded-l-xl p-2 border border-gray-200 shadow-sm justify-center">
									<img src={event.image} alt={event.name} />
								</div>
							</div>
						)
					} else {
						return (
							<div
								key={index}
								className="m-2 w-full flex flex-wrap lg:flex-nowrap"
							>
								<div className="w-full flex flex-col bg-neutral-200 p-2 border rounded-xl border-gray-200 shadow-sm">
									<div className="w-full flex justify-center text-lg bg-white border-white rounded-xl mb-2 font-medium">
										{format(event.start_date, "MMMM d, yyyy")} through{" "}
										{format(event.end_date, "MMMM d, yyyy")}
									</div>
									<div className="flex flex-col items-center md:grid md:grid-cols-[1fr_1fr_1fr]">
										<img src={event.image} alt={event.name} className="border-0 rounded-2xl"/>
										<div className="flex justify-center p-4 bg-white rounded-xl md:rounded-none md:rounded-l-xl m-1 h-full w-full">
											{event.banner_umas[0]?.umas.map((uma, index) => {
												return (
													<div
														key={index}
														className="flex flex-col items-center justify-between p-1 mx-1 border border-gray-200 rounded-xl min-w-1/2"
													>{uma.recommendation ? (
															<div className="flex justify-center items-center w-full text-center h-1/6 border border-gray-200 rounded-xl bg-blue-400 text-base font-medium">
																{uma.recommendation}
															</div>
														) : (
															<div className="h-1/6 "></div>
														)}
														<img src={uma.image} alt={uma.name} />
														<div className="flex p-1 border border-white rounded-xl w-full text-center justify-center items-center h-1/4 text-sm font-medium">
															{uma.name}
														</div>
														
													</div>
												)
											})}
										</div>
										<div className="flex justify-center p-4 bg-white rounded-xl md:rounded-none md:rounded-r-xl m-1 h-full w-full">
											{event.banner_supports[0]?.support_cards.map(
												(card, index) => {
													return (
														<div
															key={index}
															className="flex flex-col items-center justify-between p-1 mx-1 border border-gray-200 rounded-xl min-w-1/2"
														>{card.recommendation ? (
																<div className="flex p-1 mb-1 justify-center items-center w-full text-center h-1/6 border border-gray-200 rounded-xl bg-blue-400 text-base font-medium">
																	{card.recommendation}
																</div>
															) : (
																<div className="h-1/6 p-1 mb-1"></div>
															)}
															<img src={card.image} alt={card.name} className=""/>
															<div className="flex p-1 border border-white rounded-xl w-full text-center justify-center items-center h-1/4 text-sm font-medium">
																{card.name}
															</div>
															
														</div>
													)
												}
											)}
										</div>
									</div>
								</div>
							</div>
						)
					}
				})}
			</div>
		</div>
	)
}
