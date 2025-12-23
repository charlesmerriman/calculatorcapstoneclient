import { createContext, useContext } from "react"
import type { CalculatorContextType } from "./calculatorTypes"

export const CalculatorContext = createContext<
	CalculatorContextType | undefined
>(undefined)

export const useCalculatorData = () => {
	const context = useContext(CalculatorContext)

	if (context === undefined) {
		throw new Error("calculatorData must be used within a CalculatorProvider")
	}

	return context
}
