import { createContext, useContext } from "react"
import type { CalculatorContextType } from "./calculatorTypes"

export const CalculatorContext = createContext<
	CalculatorContextType | undefined
>(undefined)

export const useCalculatorData = () => {
	const context = useContext(CalculatorContext)

	if (context === undefined) {
		throw new Error("useBannerData must be used within a BannerProvider")
	}

	return context
}
