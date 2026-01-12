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
			<div>{isDropdown ? <IncomeForm /> : ""}</div>
			<div>
				{organizedTimelineData.map((event, index) => {
					if (event.track) {
						return <div key={index}>{event.name}</div>
					} else {
						return <div key={index}>{event.name}</div>
					}
				})}
			</div>
		</div>
	)
}
